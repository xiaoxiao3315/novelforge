import { NextResponse } from "next/server";
import { findPlotFilterLabel } from "@/data/plot-filters";
import { generateDeepSeekJson, getDeepSeekModel } from "@/lib/ai/deepseek";
import { createClient } from "@/lib/supabase/server";
import {
  buildConceptPrompt,
  CONCEPT_PROMPT_VERSION,
  validateStoryConceptSchema,
  type ConceptPromptInput,
  type StoryConcept,
} from "@/prompts/concept";

type GenerateConceptBody = {
  projectId?: unknown;
  user_id?: unknown;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
};

type StoryConfigRow = {
  theme: string | null;
  genre: string | null;
  background: string | null;
  world_setting: string | null;
  protagonist: string | null;
  core_conflict: string | null;
  tone: string | null;
  serial_structure: string | null;
  extra_ideas: string | null;
};

const CONCEPT_SYSTEM_PROMPT =
  "你只输出可解析 JSON object。不得生成整本小说、章节正文、章节大纲、故事圣经或角色卡。输出必须是 JSON，不能使用 Markdown。";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as unknown;
}

function buildPromptInput(project: ProjectRow, config: StoryConfigRow): ConceptPromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: {
      theme: findPlotFilterLabel("themes", config.theme),
      genre: findPlotFilterLabel("genres", config.genre),
      background: findPlotFilterLabel("backgrounds", config.background),
      worldSetting: findPlotFilterLabel("worldSettings", config.world_setting),
      protagonist: findPlotFilterLabel("protagonists", config.protagonist),
      coreConflict: findPlotFilterLabel("coreConflicts", config.core_conflict),
      tone: findPlotFilterLabel("tones", config.tone),
      serialStructure: findPlotFilterLabel("serialStructures", config.serial_structure),
      extraIdeas: config.extra_ideas,
    },
  };
}

function buildCoreConflict(concept: StoryConcept) {
  return [
    `表层冲突：${concept.surfaceConflict}`,
    `中层冲突：${concept.middleConflict}`,
    `深层冲突：${concept.deepConflict}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateConceptBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成作品设定时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return validationError("缺少 project。");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    return serverError(projectError.message);
  }

  if (!project) {
    return validationError("缺少 project。");
  }

  const visibleProject = project;

  const { data: config, error: configError } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfigRow>();

  if (configError) {
    return serverError(configError.message);
  }

  if (!config) {
    return validationError("缺少 story_config。");
  }

  const promptInput = buildPromptInput(visibleProject, config);
  const model = getDeepSeekModel();
  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
  };

  async function writeErrorLog(error: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_concept",
      target_type: "story_concept",
      model,
      prompt_version: CONCEPT_PROMPT_VERSION,
      input: logInput,
      error,
    });
  }

  let outputText = "";

  try {
    const result = await generateDeepSeekJson({
      systemPrompt: CONCEPT_SYSTEM_PROMPT,
      userPrompt: buildConceptPrompt(promptInput),
    });

    outputText = result.outputText;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DeepSeek 请求失败。";
    const errorMessage = `DeepSeek 生成失败：${message.slice(0, 800)}`;
    await writeErrorLog(errorMessage);
    return serverError(errorMessage);
  }

  if (!outputText) {
    const error = "DeepSeek 响应缺少 JSON 文本。";
    await writeErrorLog(error);
    return serverError(error);
  }

  let parsed: unknown;

  try {
    parsed = parseJsonObject(outputText);
  } catch {
    const error = "AI 输出不是有效 JSON。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const validation = validateStoryConceptSchema(parsed);

  if (!validation.ok) {
    const error = `AI 输出 JSON 未通过作品设定 schema 校验：${validation.error}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const concept = validation.concept;

  const { data: storyConcept, error: conceptError } = await supabase
    .from("story_concepts")
    .upsert(
      {
        project_id: visibleProject.id,
        title: concept.workTitle,
        logline: concept.logline,
        protagonist: concept.protagonist,
        world_rules: concept.worldRules,
        core_conflict: buildCoreConflict(concept),
        first_volume_hook: concept.firstVolumeHook,
        content: concept,
      },
      { onConflict: "project_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (conceptError || !storyConcept) {
    const error = conceptError?.message || "作品设定保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: logError } = await supabase.from("generation_logs").insert({
    project_id: visibleProject.id,
    operation: "generate_concept",
    target_type: "story_concept",
    target_id: storyConcept.id,
    model,
    prompt_version: CONCEPT_PROMPT_VERSION,
    input: logInput,
    output: concept,
  });

  if (logError) {
    return serverError(`作品设定已保存，但生成日志写入失败：${logError.message}`);
  }

  return NextResponse.json({
    conceptId: storyConcept.id,
    concept,
  });
}
