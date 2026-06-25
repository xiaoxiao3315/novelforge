import { NextResponse } from "next/server";
import { requestHasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle, saveInternalChapter } from "@/lib/internal/store";
import {
  normalizeChapterContent,
  normalizeChapterIntervention,
  type ChapterOfficial,
} from "@/prompts/chapter";
import type { NextRequest } from "next/server";

type SetOfficialBody = {
  projectId?: unknown;
  chapterId?: unknown;
  versionId?: unknown;
  user_id?: unknown;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SetOfficialBody | null;

  if (!body || typeof body !== "object") {
    return validationError("Invalid request body.");
  }

  if ("user_id" in body) {
    return validationError("set-official does not accept user_id.");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const versionId = typeof body.versionId === "string" ? body.versionId.trim() : "";

  if (!projectId) {
    return validationError("Missing project.");
  }

  if (!chapterId) {
    return validationError("Missing chapter.");
  }

  if (!versionId) {
    return validationError("Missing version.");
  }

  const bundle = await getInternalProjectBundle(projectId);
  const chapterRow = bundle?.chapters.find((chapter) => chapter.id === chapterId) ?? null;
  const content = normalizeChapterContent(chapterRow?.content);
  const draft = content?.draft ?? null;
  const summary = content?.summary ?? null;
  const intervention = normalizeChapterIntervention(draft?.intervention);

  if (!bundle || !chapterRow || !content || !draft || !summary || !intervention) {
    return validationError("Missing local chapter draft.");
  }

  if (draft.versionId && draft.versionId !== versionId) {
    return validationError("Chapter version is stale. Refresh and retry.");
  }

  const official: ChapterOfficial = {
    versionId: draft.versionId ?? versionId,
    body: draft.body,
    summary,
    intervention,
    confirmedAt: new Date().toISOString(),
    model: draft.model,
    promptVersion: draft.promptVersion,
  };
  const savedChapter = await saveInternalChapter(projectId, chapterId, {
    ...content,
    official,
  });

  if (!savedChapter) {
    return serverError("Official chapter save failed.");
  }

  return NextResponse.json({
    chapterId,
    versionId: official.versionId,
    official,
  });
}
