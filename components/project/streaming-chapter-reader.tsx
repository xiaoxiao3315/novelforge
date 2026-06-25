"use client";

import { useEffect, useRef, useState } from "react";

type StreamDoneEvent = {
  chapterId: string;
  chapterNumber: number;
};

type StreamingChapterReaderProps = {
  projectId: string;
  chapterNumber: number;
  /** 流式完成、章节已落库后回调，参数为最终章节号。 */
  onComplete: (chapterNumber: number) => void;
  /** 用户取消或出错时回调。 */
  onClose: () => void;
};

type Phase = "streaming" | "finalizing" | "error";

/**
 * 流式章节阅读层：调用 /api/generate/chapter/stream，逐字显示正文，
 * 落库完成后回调跳转。把"几十秒黑盒等待"变成"看正文实时涌现"。
 */
export function StreamingChapterReader({
  projectId,
  chapterNumber,
  onComplete,
  onClose,
}: StreamingChapterReaderProps) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("streaming");
  const [errorMessage, setErrorMessage] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch("/api/generate/chapter/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, chapterNumber, qualityMode: "normal" }),
          signal: controller.signal,
        });

        // 校验失败时端点返回 JSON 而非流。
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("text/event-stream")) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) {
            setErrorMessage(payload?.error ?? "生成失败，请稍后重试。");
            setPhase("error");
          }
          return;
        }

        if (!response.body) {
          throw new Error("无法读取流式响应。");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const rawEvent of events) {
            const line = rawEvent.trim();
            if (!line.startsWith("data:")) {
              continue;
            }

            const json = line.slice(5).trim();
            if (!json) {
              continue;
            }

            const event = JSON.parse(json) as
              | { type: "delta"; text: string }
              | { type: "status"; stage: string }
              | { type: "error"; error: string }
              | ({ type: "done" } & StreamDoneEvent);

            if (cancelled) {
              return;
            }

            if (event.type === "delta") {
              setText((prev) => prev + event.text);
            } else if (event.type === "status" && event.stage === "finalizing") {
              setPhase("finalizing");
            } else if (event.type === "error") {
              setErrorMessage(event.error);
              setPhase("error");
              return;
            } else if (event.type === "done") {
              onComplete(event.chapterNumber);
              return;
            }
          }
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "生成请求异常。";
        setErrorMessage(`网络异常：${message}`);
        setPhase("error");
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, chapterNumber, onComplete]);

  // 正文增长时自动滚到底，跟随生成。
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text]);

  function handleCancel() {
    abortRef.current?.abort();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--line)] bg-[var(--paper)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-[var(--ink)]">
              第 {chapterNumber} 章
            </span>
            <span className="text-xs font-bold text-[var(--muted)]">
              {phase === "streaming"
                ? "正在生成……"
                : phase === "finalizing"
                  ? "正在整理与保存……"
                  : "生成中断"}
            </span>
            {phase !== "error" ? (
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--gold-strong)]" />
            ) : null}
          </div>
          <button
            className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)] transition hover:bg-[rgba(138,58,33,0.06)]"
            onClick={handleCancel}
            type="button"
          >
            {phase === "error" ? "关闭" : "取消"}
          </button>
        </div>

        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-6 py-5 leading-8 text-[var(--ink)]"
        >
          {phase === "error" ? (
            <p className="rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-4 py-3 text-sm text-[#7f2f1d]">
              {errorMessage}
            </p>
          ) : text ? (
            <p className="whitespace-pre-wrap">
              {text}
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[var(--ink)] align-middle" />
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">正在唤起笔锋，马上开始……</p>
          )}
        </div>
      </div>
    </div>
  );
}
