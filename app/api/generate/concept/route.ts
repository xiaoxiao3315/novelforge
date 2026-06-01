import { NextResponse } from "next/server";
import { findPlotFilterLabel } from "@/data/plot-filters";
import { createClient } from "@/lib/supabase/server";
import {
  buildConceptPrompt,
  conceptJsonSchema,
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

type ResponsesApiPayload = {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  return "";
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
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
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

  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    const message = "缺少 OPENAI_API_KEY。";
    await writeErrorLog(message);
    return serverError(message);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "你只输出可解析 JSON。不得生成整本小说、章节正文、章节大纲、故事圣经或角色卡。",
        },
        {
          role: "user",
          content: buildConceptPrompt(promptInput),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "novel_concept",
          schema: conceptJsonSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  }).catch((error: unknown) => ({
    ok: false,
    status: 500,
    text: async () => (error instanceof Error ? error.message : "OpenAI 请求失败。"),
    json: async () => ({}),
  }));

  if (!response.ok) {
    const message = await response.text();
    const error = `OpenAI 生成失败：${message.slice(0, 800)}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const payload = (await response.json().catch(() => null)) as ResponsesApiPayload | null;
  const outputText = payload ? extractOutputText(payload) : "";

  if (!payload || payload.error?.message || !outputText) {
    const error = payload?.error?.message || "OpenAI 响应缺少 JSON 文本。";
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
