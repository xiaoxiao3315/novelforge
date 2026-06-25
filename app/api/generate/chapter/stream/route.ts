import { NextRequest, NextResponse } from "next/server";
import { generateDeepSeekTextStream } from "@/lib/ai/deepseek";
import {
  CHAPTER_MAX_TOKENS,
  CHAPTER_SYSTEM_PROMPT,
  CHAPTER_TEMPERATURE,
  cleanChapterBody,
  finalizeChapterGeneration,
  prepareChapterGeneration,
  type GenerateChapterBody,
} from "@/lib/chapters/generation";
import { requestHasInternalSession } from "@/lib/internal/auth";
import { buildChapterPrompt } from "@/prompts/chapter";

// 流式生成章节正文：普通模式逐字推送，结束后落库并推送最终元数据。
// 质量(精修)模式不走流式——其 critique→rewrite 会推翻初稿，逐字显示反而困惑，
// 前端在质量模式下应调用非流式 /api/generate/chapter。
export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateChapterBody | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if ("user_id" in body) {
    return NextResponse.json(
      { error: "生成章节正文时不能从前端传 user_id。" },
      { status: 400 },
    );
  }

  if (body.qualityMode === "quality") {
    return NextResponse.json(
      { error: "精修模式不支持流式生成，请使用普通生成接口。" },
      { status: 400 },
    );
  }

  const prepared = await prepareChapterGeneration(body);

  if (!prepared.ok) {
    // 复用非流式的校验错误响应（JSON），前端在 fetch 后据 content-type 判断。
    return prepared.response;
  }

  if (prepared.earlyResponse) {
    return prepared.earlyResponse;
  }

  const { promptInput } = prepared.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        let rawText = "";

        for await (const chunk of generateDeepSeekTextStream({
          systemPrompt: CHAPTER_SYSTEM_PROMPT,
          userPrompt: buildChapterPrompt(promptInput),
          maxTokens: CHAPTER_MAX_TOKENS,
          temperature: CHAPTER_TEMPERATURE,
        })) {
          if (chunk.type === "delta") {
            rawText += chunk.text;
            send({ type: "delta", text: chunk.text });
          } else {
            rawText = chunk.fullText;
          }
        }

        const outputText = cleanChapterBody(rawText);

        if (!outputText) {
          send({ type: "error", error: "DeepSeek 响应缺少章节正文。" });
          controller.close();
          return;
        }

        // 正文流式结束，开始落库（摘要 + 自动分歧 + 保存）。
        send({ type: "status", stage: "finalizing" });

        const finalized = await finalizeChapterGeneration(prepared.data, outputText, null);

        if (!finalized.ok) {
          const payload = (await finalized.response.json().catch(() => null)) as {
            error?: string;
          } | null;
          send({ type: "error", error: payload?.error ?? "章节保存失败。" });
          controller.close();
          return;
        }

        send({
          type: "done",
          chapterId: finalized.chapterId,
          chapterNumber: prepared.data.chapter.chapterNumber,
          ...(finalized.autoDecisionSummary
            ? { autoDecision: finalized.autoDecisionSummary }
            : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", error: `生成失败：${message.slice(0, 400)}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
