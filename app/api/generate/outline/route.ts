import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson, getDeepSeekModel } from "@/lib/ai/deepseek";
import {
  GENERATION_CREDIT_COSTS,
  requireGenerationCredits,
  spendGenerationCredits,
} from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  buildOutlinePrompt,
  OUTLINE_PROMPT_VERSION,
  validateOutlineGenerationSchema,
  type ChapterOutline,
  type OutlinePromptInput,
  type VolumeOutline,
} from "@/prompts/outline";

type GenerateOutlineBody = {
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

type StoryBibleRow = {
  content: StoryBible | null;
};

type CharacterRow = {
  content: CharacterCard | null;
};

type VolumeIdRow = {
  id: string;
};

type GenerationLogIdRow = {
  id: string;
};

const OUTLINE_GENERATION_ATTEMPTS = 2;
const OUTLINE_MAX_TOKENS = 8192;
const OUTLINE_TEMPERATURE = 0.1;
const RAW_OUTPUT_PREVIEW_LENGTH = 1000;
const OUTLINE_SYSTEM_PROMPT = [
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown。不要代码块。不要解释。不要任何 JSON 前后的多余文本。",
  "首字符必须是 {，末字符必须是 }。",
  "严格匹配用户提供的目标 JSON 结构：顶层只能包含 volume 和 chapters。",
  "只生成第一卷章节大纲，不得生成章节正文、TipTap、改写、续写、收费、社区或排行榜内容。",
].join(" ");

type JsonParseFailure = {
  attempt: number;
  errorType: string;
  message: string;
  outputLength: number;
  finishReason: string | null;
  rawPreview: string;
};

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

function getErrorType(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return typeof error;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildJsonParseFailure(
  attempt: number,
  outputText: string,
  finishReason: string | null,
  error: unknown,
): JsonParseFailure {
  return {
    attempt,
    errorType: getErrorType(error),
    message: getErrorMessage(error).slice(0, 800),
    outputLength: outputText.length,
    finishReason,
    rawPreview: outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
  };
}

function buildEmptyOutputFailure(
  attempt: number,
  finishReason: string | null,
): JsonParseFailure {
  return {
    attempt,
    errorType: "EmptyOutput",
    message: "DeepSeek 响应缺少 JSON 文本。",
    outputLength: 0,
    finishReason,
    rawPreview: "",
  };
}

function formatJsonParseFailureLog(failures: JsonParseFailure[]) {
  return [
    `AI 输出不是有效 JSON（已尝试 ${failures.length} 次）。`,
    ...failures.flatMap((failure) => [
      [
        `attempt=${failure.attempt}`,
        `errorType=${failure.errorType}`,
        `message=${failure.message}`,
        `outputLength=${failure.outputLength}`,
        `finishReason=${failure.finishReason ?? "unknown"}`,
        `rawPreviewFirst${RAW_OUTPUT_PREVIEW_LENGTH}Chars:`,
      ].join("; "),
      failure.rawPreview,
    ]),
  ].join("\n");
}

function buildPromptInput(
  project: ProjectRow,
  config: StoryConfigRow,
  concept: StoryConcept,
  bible: StoryBible,
  characters: CharacterCard[],
): OutlinePromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: {
      ...buildStoryConfigPromptData(config),
    },
    concept,
    bible,
    characters,
  };
}

function buildVolumeRow(projectId: string, volume: VolumeOutline) {
  return {
    project_id: projectId,
    volume_number: volume.volumeNumber,
    title: volume.title,
    summary: volume.summary,
    main_conflict: volume.mainConflict,
    ending_hook: volume.endingHook,
    content: volume,
  };
}

function buildChapterRow(projectId: string, volumeId: string, chapter: ChapterOutline) {
  return {
    project_id: projectId,
    volume_id: volumeId,
    chapter_number: chapter.chapterNumber,
    title: chapter.title,
    event: chapter.event,
    conflict: chapter.conflict,
    character_change: chapter.characterChange,
    highlight: chapter.highlight,
    foreshadowing: chapter.foreshadowing,
    ending_hook: chapter.endingHook,
    estimated_words: chapter.estimatedWords,
    content: chapter,
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

  const body = (await request.json().catch(() => null)) as GenerateOutlineBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成章节大纲时不能从前端传 user_id。");
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
    .eq("user_id", user.id)
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
    .eq("user_id", user.id)
    .maybeSingle<StoryConceptRow>();

  if (conceptError) {
    return serverError(conceptError.message);
  }

  const concept = normalizeStoryConcept(storyConcept?.content);

  if (!concept) {
    return validationError("缺少 story_concept。");
  }

  const { data: storyBible, error: bibleError } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<StoryBibleRow>();

  if (bibleError) {
    return serverError(bibleError.message);
  }

  const bible = normalizeStoryBible(storyBible?.content);

  if (!bible) {
    return validationError("缺少 story_bible。");
  }

  const { data: characterRows, error: charactersError } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();

  if (charactersError) {
    return serverError(charactersError.message);
  }

  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  if (characters.length === 0) {
    return validationError("缺少 characters。");
  }

  const promptInput = buildPromptInput(visibleProject, config, concept, bible, characters);
  const model = getDeepSeekModel();
  const creditCheck = await requireGenerationCredits(supabase, "generate_outline");

  if (!creditCheck.ok) {
    return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status ?? 500 });
  }

  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
    storyConcept: concept,
    storyBible: bible,
    characters,
  };

  async function writeErrorLog(error: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_outline",
      target_type: "volume",
      model,
      prompt_version: OUTLINE_PROMPT_VERSION,
      input: logInput,
      error,
    });
  }

  const userPrompt = buildOutlinePrompt(promptInput);
  const parseFailures: JsonParseFailure[] = [];
  let parsed: unknown;
  let parsedSuccessfully = false;

  for (let attempt = 1; attempt <= OUTLINE_GENERATION_ATTEMPTS; attempt += 1) {
    let result: Awaited<ReturnType<typeof generateDeepSeekJson>>;

    try {
      result = await generateDeepSeekJson({
        systemPrompt: OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: OUTLINE_MAX_TOKENS,
        temperature: OUTLINE_TEMPERATURE,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      const errorMessage = `DeepSeek 生成失败（第 ${attempt} 次）：${message.slice(0, 800)}`;
      const logMessage =
        parseFailures.length > 0
          ? `${errorMessage}\n\n此前 JSON parse 失败详情：\n${formatJsonParseFailureLog(parseFailures)}`
          : errorMessage;

      await writeErrorLog(logMessage);
      return serverError(errorMessage);
    }

    if (!result.outputText) {
      parseFailures.push(buildEmptyOutputFailure(attempt, result.finishReason));
    } else {
      try {
        parsed = parseJsonObject(result.outputText);
        parsedSuccessfully = true;
        break;
      } catch (error) {
        parseFailures.push(
          buildJsonParseFailure(attempt, result.outputText, result.finishReason, error),
        );
      }
    }

    if (attempt === OUTLINE_GENERATION_ATTEMPTS) {
      await writeErrorLog(formatJsonParseFailureLog(parseFailures));
      return serverError("AI 输出不是有效 JSON。");
    }
  }

  if (!parsedSuccessfully) {
    const error = "AI 输出不是有效 JSON。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const validation = validateOutlineGenerationSchema(parsed);

  if (!validation.ok) {
    const error = `AI 输出 JSON 未通过章节大纲 schema 校验：${validation.error}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const { volume, chapters } = validation;

  const { data: savedVolume, error: volumeError } = await supabase
    .from("volumes")
    .upsert(buildVolumeRow(visibleProject.id, volume), {
      onConflict: "project_id,volume_number",
    })
    .select("id")
    .single<VolumeIdRow>();

  if (volumeError || !savedVolume) {
    const error = volumeError?.message || "卷信息保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: chapterError } = await supabase
    .from("chapters")
    .upsert(
      chapters.map((chapter) => buildChapterRow(visibleProject.id, savedVolume.id, chapter)),
      { onConflict: "project_id,chapter_number" },
    );

  if (chapterError) {
    const error = chapterError.message || "章节大纲保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { data: generationLog, error: logError } = await supabase
    .from("generation_logs")
    .insert({
      project_id: visibleProject.id,
      operation: "generate_outline",
      target_type: "volume",
      target_id: savedVolume.id,
      model,
      prompt_version: OUTLINE_PROMPT_VERSION,
      input: logInput,
      output: {
        volume,
        chapters,
      },
    })
    .select("id")
    .single<GenerationLogIdRow>();

  if (logError || !generationLog) {
    return serverError(`章节大纲已保存，但生成日志写入失败：${logError?.message || "未知错误"}`);
  }

  const creditSpend = await spendGenerationCredits({
    supabase,
    projectId: visibleProject.id,
    generationLogId: generationLog.id,
    operation: "generate_outline",
    reason: "生成章节大纲",
  });

  if (!creditSpend.ok) {
    return serverError(`章节大纲已保存，但点数扣除失败：${creditSpend.error}`);
  }

  return NextResponse.json({
    volumeId: savedVolume.id,
    volume,
    chapters,
    credits: {
      cost: GENERATION_CREDIT_COSTS.generate_outline,
      balance: creditSpend.balanceAfter,
    },
  });
}
