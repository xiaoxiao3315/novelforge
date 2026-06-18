import { NextResponse } from "next/server";
import { hasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle, saveInternalChapter } from "@/lib/internal/store";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeChapterContent,
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

export async function POST(request: Request) {
  if (await hasInternalSession()) {
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
    .eq("user_id", user.id)
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

  // 单个事务内完成：清旧官方版本、标记新官方版本、更新章节内容（见 wo017 RPC）。
  const { error: rpcError } = await supabase.rpc("set_official_chapter_version", {
    p_project_id: projectId,
    p_chapter_id: chapterId,
    p_version_id: version.id,
    p_official: official,
  });

  if (rpcError) {
    return serverError(rpcError.message);
  }

  return NextResponse.json({
    chapterId,
    versionId: version.id,
    official,
  });
}
