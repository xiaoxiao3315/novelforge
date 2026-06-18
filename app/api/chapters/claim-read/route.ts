import { NextResponse } from "next/server";
import { GENERATION_CREDIT_COSTS, spendGenerationCredits } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { normalizeChapterContent } from "@/prompts/chapter";

type ClaimReadBody = {
  projectId?: unknown;
  chapterId?: unknown;
  chapterNumber?: unknown;
  user_id?: unknown;
};

type ChapterRow = {
  id: string;
  content: unknown;
  chapter_number: number;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInsufficientCreditsError(message: string) {
  return /insufficient credits|点数不足|星火不足/i.test(message);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ClaimReadBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("章节阅读扣费时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isInteger(body.chapterNumber)
      ? body.chapterNumber
      : null;

  if (!projectId) {
    return validationError("缺少 project。");
  }

  if (!chapterId && !chapterNumber) {
    return validationError("缺少 chapter。");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!project) {
    return validationError("缺少 project。");
  }

  let chapterQuery = supabase
    .from("chapters")
    .select("id,content,chapter_number")
    .eq("project_id", project.id)
    .eq("user_id", user.id);

  if (chapterId) {
    chapterQuery = chapterQuery.eq("id", chapterId);
  } else if (chapterNumber) {
    chapterQuery = chapterQuery.eq("chapter_number", chapterNumber);
  }

  const { data: chapterRow, error: chapterError } =
    await chapterQuery.maybeSingle<ChapterRow>();

  if (chapterError) {
    return serverError(chapterError.message);
  }

  const chapter = normalizeChapterContent(chapterRow?.content);

  if (!chapterRow || !chapter) {
    return validationError("缺少 chapter。");
  }

  const readBilling = chapter.readBilling;

  if (!readBilling || readBilling.state === "charged") {
    return NextResponse.json({
      chapterId: chapterRow.id,
      charged: false,
      credits:
        typeof readBilling?.balanceAfter === "number"
          ? { balance: readBilling.balanceAfter }
          : null,
    });
  }

  const creditSpend = await spendGenerationCredits({
    supabase,
    projectId: project.id,
    generationLogId: readBilling.generationLogId,
    operation: "claim_read_chapter",
    reason: `阅读第 ${chapter.chapterNumber} 章`,
  });

  if (!creditSpend.ok) {
    const status = isInsufficientCreditsError(creditSpend.error) ? 402 : 500;
    return NextResponse.json(
      {
        error:
          status === 402
            ? "星火不足，无法继续阅读"
            : `章节阅读扣费失败：${creditSpend.error}`,
      },
      { status },
    );
  }

  const nextReadBilling = {
    ...readBilling,
    state: "charged" as const,
    chargedAt: new Date().toISOString(),
    ...(creditSpend.transactionId ? { creditTransactionId: creditSpend.transactionId } : {}),
    ...(typeof creditSpend.balanceAfter === "number"
      ? { balanceAfter: creditSpend.balanceAfter }
      : {}),
  };
  const content = {
    ...(isRecord(chapterRow.content) ? chapterRow.content : {}),
    readBilling: nextReadBilling,
  };
  const { error: updateError } = await supabase
    .from("chapters")
    .update({ content })
    .eq("id", chapterRow.id)
    .eq("project_id", project.id)
    .eq("user_id", user.id);

  if (updateError) {
    return serverError(updateError.message);
  }

  return NextResponse.json({
    chapterId: chapterRow.id,
    charged: true,
    credits: {
      cost: GENERATION_CREDIT_COSTS.claim_read_chapter,
      balance: creditSpend.balanceAfter,
    },
  });
}
