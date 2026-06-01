import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeChapterIntervention,
  type ChapterOfficial,
} from "@/prompts/chapter";
import { normalizeChapterSummary } from "@/prompts/chapter-summary";

type SetOfficialBody = {
  projectId?: unknown;
  chapterId?: unknown;
  versionId?: unknown;
  user_id?: unknown;
};

type ProjectRow = {
  id: string;
};

type ChapterRow = {
  id: string;
  content: unknown;
};

type ChapterVersionRow = {
  id: string;
  body: string;
  summary: unknown;
  intervention: unknown;
  model: string;
  prompt_version: string;
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SetOfficialBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("设置正式稿时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const versionId = typeof body.versionId === "string" ? body.versionId.trim() : "";

  if (!projectId) {
    return validationError("缺少 project。");
  }

  if (!chapterId) {
    return validationError("缺少 chapter。");
  }

  if (!versionId) {
    return validationError("缺少 version。");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    return serverError(projectError.message);
  }

  if (!project) {
    return validationError("缺少 project。");
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id,content")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<ChapterRow>();

  if (chapterError) {
    return serverError(chapterError.message);
  }

  if (!chapter) {
    return validationError("缺少 chapter。");
  }

  const { data: version, error: versionError } = await supabase
    .from("chapter_versions")
    .select("id,body,summary,intervention,model,prompt_version")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id)
    .maybeSingle<ChapterVersionRow>();

  if (versionError) {
    return serverError(versionError.message);
  }

  const summary = normalizeChapterSummary(version?.summary);
  const intervention = normalizeChapterIntervention(version?.intervention);

  if (!version || !summary || !intervention) {
    return validationError("缺少可设置为正式稿的 chapter version。");
  }

  const official: ChapterOfficial = {
    versionId: version.id,
    body: version.body,
    summary,
    intervention,
    confirmedAt: new Date().toISOString(),
    model: version.model,
    promptVersion: version.prompt_version,
  };

  const { error: clearError } = await supabase
    .from("chapter_versions")
    .update({ is_official: false })
    .eq("project_id", projectId)
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id);

  if (clearError) {
    return serverError(clearError.message);
  }

  const { error: markError } = await supabase
    .from("chapter_versions")
    .update({ is_official: true })
    .eq("id", version.id)
    .eq("project_id", projectId)
    .eq("chapter_id", chapterId)
    .eq("user_id", user.id);

  if (markError) {
    return serverError(markError.message);
  }

  const content = {
    ...(isRecord(chapter.content) ? chapter.content : {}),
    official,
  };

  const { error: updateChapterError } = await supabase
    .from("chapters")
    .update({ content })
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (updateChapterError) {
    return serverError(updateChapterError.message);
  }

  return NextResponse.json({
    chapterId,
    versionId: version.id,
    official,
  });
}
