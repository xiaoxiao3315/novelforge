import { NextResponse } from "next/server";
import { isValidPlotFilterValue } from "@/data/plot-filters";
import { isProjectMode, normalizeProjectMode } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";

type ProjectRequestBody = {
  title?: unknown;
  description?: unknown;
  theme?: unknown;
  genre?: unknown;
  background?: unknown;
  worldSetting?: unknown;
  protagonist?: unknown;
  coreConflict?: unknown;
  tone?: unknown;
  serialStructure?: unknown;
  extraIdeas?: unknown;
  mode?: unknown;
  user_id?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ProjectRequestBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("创建作品时不能从前端传 user_id。");
  }

  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 200);
  const extraIdeas = cleanText(body.extraIdeas, 1200);
  const mode = normalizeProjectMode(body.mode);

  if (!title) {
    return validationError("请填写作品名。");
  }

  if (body.mode !== undefined && !isProjectMode(body.mode)) {
    return validationError("项目模式不合法。");
  }

  const requiredFilters = [
    ["themes", body.theme],
    ["genres", body.genre],
    ["backgrounds", body.background],
    ["worldSettings", body.worldSetting],
    ["protagonists", body.protagonist],
    ["coreConflicts", body.coreConflict],
    ["tones", body.tone],
    ["serialStructures", body.serialStructure],
  ] as const;

  const hasInvalidFilter = requiredFilters.some(
    ([key, value]) => !isValidPlotFilterValue(key, value),
  );

  if (hasInvalidFilter) {
    return validationError("剧情筛选器选项不合法。");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      title,
      description: description || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message || "作品创建失败。" },
      { status: 500 },
    );
  }

  const { error: configError } = await supabase.from("story_configs").insert({
    project_id: project.id,
    theme: body.theme,
    genre: body.genre,
    background: body.background,
    world_setting: body.worldSetting,
    protagonist: body.protagonist,
    core_conflict: body.coreConflict,
    tone: body.tone,
    serial_structure: body.serialStructure,
    extra_ideas: extraIdeas || null,
    config_json: {
      theme: body.theme,
      genre: body.genre,
      background: body.background,
      worldSetting: body.worldSetting,
      protagonist: body.protagonist,
      coreConflict: body.coreConflict,
      tone: body.tone,
      serialStructure: body.serialStructure,
      extraIdeas,
      mode,
    },
  });

  if (configError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  return NextResponse.json({ projectId: project.id }, { status: 201 });
}
