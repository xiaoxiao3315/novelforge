import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson, getDeepSeekModel } from "@/lib/ai/deepseek";
import { parseJsonObject } from "@/lib/ai/json";
import {
  GENERATION_CREDIT_COSTS,
  refundGenerationCredits,
  requireGenerationCredits,
  spendGenerationCredits,
} from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildBiblePrompt,
  BIBLE_PROMPT_VERSION,
  validateStoryBibleGenerationSchema,
  type BiblePromptInput,
} from "@/prompts/bible";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";

type GenerateBibleBody = {
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
  config_json: unknown;
};

type StoryConceptRow = {
  content: StoryConcept | null;
};

type GenerationLogIdRow = {
  id: string;
};

const BIBLE_SYSTEM_PROMPT =
  "你只输出可解析 JSON object。不得生成章节大纲、章节正文、改写、续写、收费、社区或排行榜内容。输出必须是 JSON，不能使用 Markdown。";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function buildPromptInput(
  project: ProjectRow,
  config: StoryConfigRow,
  concept: StoryConcept,
): BiblePromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: {
      ...buildStoryConfigPromptData(config),
    },
    concept,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const userId = user.id;
  const body = (await request.json().catch(() => null)) as GenerateBibleBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成故事圣经时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return validationError("缺少 project。");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description")
    .eq("id", projectId)
    .eq("user_id", user.id)
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
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas,config_json",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfigRow>();

  if (configError) {
    return serverError(configError.message);
  }

  if (!config) {
    return validationError("缺少 story_config。");
  }

  const { data: storyConcept, error: conceptError } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();

  if (conceptError) {
    return serverError(conceptError.message);
  }

  const concept = normalizeStoryConcept(storyConcept?.content);

  if (!concept) {
    return validationError("缺少 story_concept。");
  }

  const promptInput = buildPromptInput(visibleProject, config, concept);
  const model = getDeepSeekModel();
  const creditCheck = await requireGenerationCredits(supabase, "generate_bible");

  if (!creditCheck.ok) {
    return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status ?? 500 });
  }

  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
    storyConcept: concept,
  };

  async function writeErrorLog(error: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_bible",
      target_type: "story_bible",
      model,
      prompt_version: BIBLE_PROMPT_VERSION,
      input: logInput,
      error,
    });
  }

  let outputText = "";

  try {
    const result = await generateDeepSeekJson({
      systemPrompt: BIBLE_SYSTEM_PROMPT,
      userPrompt: buildBiblePrompt(promptInput),
      maxTokens: 3600,
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

  const validation = validateStoryBibleGenerationSchema(parsed);

  if (!validation.ok) {
    const error = `AI 输出 JSON 未通过故事圣经 schema 校验：${validation.error}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const { bible, characters } = validation;

  // 先记日志、再扣点、最后落库：扣点失败时不保存内容，保存失败时自动退点。
  const { data: generationLog, error: logError } = await supabase
    .from("generation_logs")
    .insert({
      project_id: visibleProject.id,
      operation: "generate_bible",
      target_type: "story_bible",
      model,
      prompt_version: BIBLE_PROMPT_VERSION,
      input: logInput,
    })
    .select("id")
    .single<GenerationLogIdRow>();

  if (logError || !generationLog) {
    return serverError(`生成日志写入失败，本次未扣费：${logError?.message || "未知错误"}`);
  }

  const creditSpend = await spendGenerationCredits({
    supabase,
    projectId: visibleProject.id,
    generationLogId: generationLog.id,
    operation: "generate_bible",
    reason: "生成故事圣经和角色卡",
  });

  if (!creditSpend.ok) {
    const error = `点数扣除失败，内容未保存：${creditSpend.error}`;
    await supabase.from("generation_logs").update({ error }).eq("id", generationLog.id);
    const insufficient = creditSpend.error.includes("insufficient credits");
    return NextResponse.json(
      { error: insufficient ? "点数不足，本次未扣费，内容未保存。" : error },
      { status: insufficient ? 402 : 500 },
    );
  }

  async function refundAndLogSaveFailure(saveError: string) {
    const refund = await refundGenerationCredits({
      supabase: createAdminClient(),
      generationLogId: generationLog!.id,
      userId,
    });
    const refundNote = refund.ok ? "已自动退还本次点数。" : `自动退点失败：${refund.error}`;
    await supabase
      .from("generation_logs")
      .update({ error: `${saveError}（${refundNote}）` })
      .eq("id", generationLog!.id);
    return refundNote;
  }

  const { data: storyBibleId, error: bibleError } = await supabase.rpc(
    "save_story_bible_generation",
    {
      p_project_id: visibleProject.id,
      p_generation_log_id: generationLog.id,
      p_bible: bible,
      p_characters: characters,
    },
  );

  if (bibleError || !storyBibleId) {
    const saveError = bibleError?.message || "故事圣经和角色卡保存失败。";
    const refundNote = await refundAndLogSaveFailure(saveError);
    return serverError(`故事圣经和角色卡保存失败，${refundNote}`);
  }

  return NextResponse.json({
    bibleId: storyBibleId,
    bible,
    characters,
    credits: {
      cost: GENERATION_CREDIT_COSTS.generate_bible,
      balance: creditSpend.balanceAfter,
    },
  });
}
