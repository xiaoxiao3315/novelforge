import { NextResponse } from "next/server";
import { requestHasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle, saveInternalChapter } from "@/lib/internal/store";
import { normalizeChapterContent } from "@/prompts/chapter";
import type { NextRequest } from "next/server";

type ClaimReadBody = {
  projectId?: unknown;
  chapterId?: unknown;
  chapterNumber?: unknown;
  user_id?: unknown;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ClaimReadBody | null;

  if (!body || typeof body !== "object") {
    return validationError("Invalid request body.");
  }

  if ("user_id" in body) {
    return validationError("claim-read does not accept user_id.");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isInteger(body.chapterNumber)
      ? body.chapterNumber
      : null;

  if (!projectId) {
    return validationError("Missing project.");
  }

  if (!chapterId && !chapterNumber) {
    return validationError("Missing chapter.");
  }

  const bundle = await getInternalProjectBundle(projectId);
  const chapterRow =
    (chapterId ? bundle?.chapters.find((chapter) => chapter.id === chapterId) : null) ??
    (chapterNumber
      ? bundle?.chapters.find((chapter) => chapter.chapter_number === chapterNumber)
      : null);
  const chapter = normalizeChapterContent(chapterRow?.content);

  if (!bundle || !chapterRow || !chapter) {
    return validationError("Missing chapter.");
  }

  if (!chapter.readBilling || chapter.readBilling.state === "charged") {
    return NextResponse.json({
      chapterId: chapterRow.id,
      charged: false,
      credits: { balance: 9999 },
    });
  }

  await saveInternalChapter(projectId, chapterRow.id, {
    ...chapter,
    readBilling: {
      ...chapter.readBilling,
      state: "charged",
      chargedAt: new Date().toISOString(),
      balanceAfter: 9999,
    },
  });

  return NextResponse.json({
    chapterId: chapterRow.id,
    charged: true,
    credits: {
      cost: 0,
      balance: 9999,
    },
  });
}
