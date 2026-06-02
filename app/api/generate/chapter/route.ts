import { NextResponse } from "next/server";
import { findPlotFilterLabel } from "@/data/plot-filters";
import { generateDeepSeekJson, generateDeepSeekText, getDeepSeekModel } from "@/lib/ai/deepseek";
import {
  GENERATION_CREDIT_COSTS,
  requireGenerationCredits,
  spendGenerationCredits,
} from "@/lib/credits";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import {
  buildChapterContent,
  buildChapterDraft,
  buildChapterPrompt,
  buildPreviousChapterContext,
  CHAPTER_INTERVENTION_LIMITS,
  CHAPTER_PROMPT_VERSION,
  DEFAULT_CHAPTER_WORD_TARGET,
  EMPTY_CHAPTER_INTERVENTION,
  type ChapterIntervention,
  type ChapterPromptInput,
} from "@/prompts/chapter";
import { normalizeChapterDecision } from "@/prompts/chapter-decision";
import {
  buildChapterSummary,
  buildChapterSummaryPrompt,
  CHAPTER_SUMMARY_PROMPT_VERSION,
  validateChapterSummaryOutput,
} from "@/prompts/chapter-summary";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  normalizeChapterOutlines,
  normalizeVolumeOutline,
  type ChapterOutline,
  type VolumeOutline,
} from "@/prompts/outline";

type GenerateChapterBody = {
  projectId?: unknown;
  chapterId?: unknown;
  chapterNumber?: unknown;
  intervention?: unknown;
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

type VolumeRow = {
  content: unknown;
};

type ChapterRow = {
  id: string;
  content: unknown;
  chapter_number: number;
  title: string;
  event: string;
  conflict: string;
  character_change: string;
  highlight: string;
  foreshadowing: string;
  ending_hook: string;
  estimated_words: number;
};

type ChapterVersionNumberRow = {
  version_number: number;
};

type ChapterVersionIdRow = {
  id: string;
  version_number: number;
};

type GenerationLogIdRow = {
  id: string;
};

const CHAPTER_MAX_TOKENS = 6000;
const CHAPTER_TEMPERATURE = 0.72;
const CHAPTER_SUMMARY_GENERATION_ATTEMPTS = 2;
const CHAPTER_SUMMARY_MAX_TOKENS = 1800;
const CHAPTER_SUMMARY_TEMPERATURE = 0.1;
const RAW_OUTPUT_PREVIEW_LENGTH = 1000;
const CHAPTER_SYSTEM_PROMPT = [
  "你只输出中文小说正文。",
  "不要 Markdown，不要代码块，不要解释，不要大纲，不要标题分析。",
  "只写当前一章，不提前生成下一章，不生成整本小说。",
].join(" ");
const CHAPTER_SUMMARY_SYSTEM_PROMPT = [
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
  "所有字符串字段必须是单行短句，不要在 JSON string 中输出裸换行、制表符或控制字符。",
  "只总结当前章节，不写正文，不续写，不生成整本小说。",
].join(" ");

type SummaryJsonParseFailure = {
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getErrorType(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return typeof error;
}

function cleanChapterBody(text: string) {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as unknown;
}

function isControlCharacterJsonError(error: unknown) {
  return /control character|bad control|unexpected token[\s\S]*(?:\n|\r|\t)/i.test(
    getErrorMessage(error),
  );
}

function escapeControlCharactersInJsonStrings(text: string) {
  let result = "";
  let inString = false;
  let escaping = false;

  for (const character of text) {
    if (!inString) {
      result += character;

      if (character === "\"") {
        inString = true;
      }

      continue;
    }

    if (escaping) {
      result += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaping = true;
      continue;
    }

    if (character === "\"") {
      result += character;
      inString = false;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;

    if (character === "\n") {
      result += "\\n";
    } else if (character === "\r") {
      result += "\\r";
    } else if (character === "\t") {
      result += "\\t";
    } else if (codePoint >= 0 && codePoint <= 0x1f) {
      result += `\\u${codePoint.toString(16).padStart(4, "0")}`;
    } else {
      result += character;
    }
  }

  return result;
}

function parseSummaryJsonObject(text: string) {
  try {
    return parseJsonObject(text);
  } catch (error) {
    if (!isControlCharacterJsonError(error)) {
      throw error;
    }

    const trimmed = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(escapeControlCharactersInJsonStrings(trimmed)) as unknown;
  }
}

function buildSummaryJsonParseFailure(
  attempt: number,
  outputText: string,
  finishReason: string | null,
  error: unknown,
): SummaryJsonParseFailure {
  return {
    attempt,
    errorType: getErrorType(error),
    message: getErrorMessage(error).slice(0, 800),
    outputLength: outputText.length,
    finishReason,
    rawPreview: outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
  };
}

function buildEmptySummaryOutputFailure(
  attempt: number,
  finishReason: string | null,
): SummaryJsonParseFailure {
  return {
    attempt,
    errorType: "EmptyOutput",
    message: "DeepSeek 响应缺少章节摘要 JSON。",
    outputLength: 0,
    finishReason,
    rawPreview: "",
  };
}

function formatSummaryJsonFailureLog(failures: SummaryJsonParseFailure[]) {
  return [
    `DeepSeek 摘要 JSON 解析失败（已尝试 ${failures.length} 次）。`,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInterventionField(
  source: Record<string, unknown>,
  key: keyof ChapterIntervention,
): { ok: true; value: string } | { ok: false; error: string } {
  const rawValue = source[key];

  if (rawValue === undefined || rawValue === null) {
    return { ok: true, value: "" };
  }

  if (typeof rawValue !== "string") {
    return { ok: false, error: `干预字段 ${key} 必须是字符串。` };
  }

  const value = rawValue.trim();
  const limit = CHAPTER_INTERVENTION_LIMITS[key];

  if (value.length > limit) {
    return { ok: false, error: `干预字段 ${key} 不能超过 ${limit} 字符。` };
  }

  return { ok: true, value };
}

function parseChapterIntervention(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, intervention: EMPTY_CHAPTER_INTERVENTION };
  }

  if (!isRecord(value)) {
    return { ok: false as const, error: "intervention 必须是 JSON object。" };
  }

  const directorInstruction = readInterventionField(value, "directorInstruction");
  const styleFocus = readInterventionField(value, "styleFocus");
  const mustInclude = readInterventionField(value, "mustInclude");
  const mustAvoid = readInterventionField(value, "mustAvoid");
  const endingRequirement = readInterventionField(value, "endingRequirement");

  if (!directorInstruction.ok) {
    return directorInstruction;
  }

  if (!styleFocus.ok) {
    return styleFocus;
  }

  if (!mustInclude.ok) {
    return mustInclude;
  }

  if (!mustAvoid.ok) {
    return mustAvoid;
  }

  if (!endingRequirement.ok) {
    return endingRequirement;
  }

  return {
    ok: true as const,
    intervention: {
      directorInstruction: directorInstruction.value,
      styleFocus: styleFocus.value,
      mustInclude: mustInclude.value,
      mustAvoid: mustAvoid.value,
      endingRequirement: endingRequirement.value,
    },
  };
}

function buildChapterOutline(row: ChapterRow): ChapterOutline | null {
  return normalizeChapterOutlines([
    {
      chapterNumber: row.chapter_number,
      title: row.title,
      event: row.event,
      conflict: row.conflict,
      characterChange: row.character_change,
      highlight: row.highlight,
      foreshadowing: row.foreshadowing,
      endingHook: row.ending_hook,
      estimatedWords: row.estimated_words,
    },
  ])[0] ?? null;
}

function buildPromptInput(
  project: ProjectRow,
  config: StoryConfigRow,
  concept: StoryConcept,
  bible: StoryBible,
  characters: CharacterCard[],
  volume: VolumeOutline,
  chapter: ChapterOutline,
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[],
  intervention: ChapterIntervention,
  previousDecision: ChapterPromptInput["previousDecision"],
  currentDecision: ChapterPromptInput["currentDecision"],
): ChapterPromptInput {
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
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters,
    intervention,
    previousDecision,
    currentDecision,
    wordTarget: chapter.estimatedWords || DEFAULT_CHAPTER_WORD_TARGET,
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

  const body = (await request.json().catch(() => null)) as GenerateChapterBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成章节正文时不能从前端传 user_id。");
  }

  const interventionValidation = parseChapterIntervention(body.intervention);

  if (!interventionValidation.ok) {
    return validationError(interventionValidation.error);
  }

  const { intervention } = interventionValidation;

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
    return validationError("缺少 chapter outline。");
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
  const model = getDeepSeekModel();

  async function writeGenerationErrorLog(
    operation: string,
    promptVersion: string,
    error: string,
    input: Record<string, unknown>,
    targetId?: string,
  ) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation,
      target_type: "chapter",
      ...(targetId ? { target_id: targetId } : {}),
      model,
      prompt_version: promptVersion,
      input,
      error,
    });
  }

  async function writeErrorLog(error: string, input: Record<string, unknown>, targetId?: string) {
    await writeGenerationErrorLog(
      "generate_chapter",
      CHAPTER_PROMPT_VERSION,
      error,
      input,
      targetId,
    );
  }

  async function writeSummaryErrorLog(
    error: string,
    input: Record<string, unknown>,
    targetId?: string,
  ) {
    await writeGenerationErrorLog(
      "generate_chapter_summary",
      CHAPTER_SUMMARY_PROMPT_VERSION,
      error,
      input,
      targetId,
    );
  }

  const baseLogInput = { project: visibleProject, intervention };

  const { data: config, error: configError } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas,config_json",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfigRow>();

  if (configError) {
    await writeErrorLog(configError.message, baseLogInput);
    return serverError(configError.message);
  }

  if (!config) {
    const error = "缺少 story_config。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  const { data: storyConcept, error: conceptError } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();

  if (conceptError) {
    await writeErrorLog(conceptError.message, baseLogInput);
    return serverError(conceptError.message);
  }

  const concept = normalizeStoryConcept(storyConcept?.content);

  if (!concept) {
    const error = "缺少 story_concept。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  const { data: storyBible, error: bibleError } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryBibleRow>();

  if (bibleError) {
    await writeErrorLog(bibleError.message, baseLogInput);
    return serverError(bibleError.message);
  }

  const bible = normalizeStoryBible(storyBible?.content);

  if (!bible) {
    const error = "缺少 story_bible。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  const { data: characterRows, error: charactersError } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();

  if (charactersError) {
    await writeErrorLog(charactersError.message, baseLogInput);
    return serverError(charactersError.message);
  }

  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  if (characters.length === 0) {
    const error = "缺少 characters。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  const { data: volumeRow, error: volumeError } = await supabase
    .from("volumes")
    .select("content")
    .eq("project_id", projectId)
    .order("volume_number", { ascending: true })
    .limit(1)
    .maybeSingle<VolumeRow>();

  if (volumeError) {
    await writeErrorLog(volumeError.message, baseLogInput);
    return serverError(volumeError.message);
  }

  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    const error = "缺少 volume。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  let chapterQuery = supabase
    .from("chapters")
    .select(
      "id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
    )
    .eq("project_id", projectId);

  if (chapterId) {
    chapterQuery = chapterQuery.eq("id", chapterId);
  } else if (chapterNumber) {
    chapterQuery = chapterQuery.eq("chapter_number", chapterNumber);
  }

  const { data: chapterRow, error: chapterError } = await chapterQuery.maybeSingle<ChapterRow>();

  if (chapterError) {
    await writeErrorLog(chapterError.message, baseLogInput);
    return serverError(chapterError.message);
  }

  const chapter = chapterRow ? buildChapterOutline(chapterRow) : null;

  if (!chapterRow || !chapter) {
    const error = "缺少 chapter outline。";
    await writeErrorLog(error, baseLogInput);
    return validationError(error);
  }

  const { data: previousRows, error: previousError } = await supabase
    .from("chapters")
    .select(
      "id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
    )
    .eq("project_id", projectId)
    .lt("chapter_number", chapter.chapterNumber)
    .order("chapter_number", { ascending: true })
    .returns<ChapterRow[]>();

  if (previousError) {
    await writeErrorLog(previousError.message, baseLogInput, chapterRow.id);
    return serverError(previousError.message);
  }

  const previousChapters = (previousRows ?? [])
    .map((row) => {
      const outline = buildChapterOutline(row);
      return outline ? buildPreviousChapterContext(outline, row.content) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const projectMode = getProjectModeFromConfig(config.config_json);
  const previousDecisionRow = (previousRows ?? []).find(
    (row) => row.chapter_number === chapter.chapterNumber - 1,
  );
  const previousDecision =
    projectMode === "interactive" && previousDecisionRow
      ? normalizeChapterDecision(
          isRecord(previousDecisionRow.content)
            ? (previousDecisionRow.content as { decision?: unknown }).decision
            : null,
        )
      : null;
  const currentDecision =
    projectMode === "interactive"
      ? normalizeChapterDecision(
          isRecord(chapterRow.content)
            ? (chapterRow.content as { decision?: unknown }).decision
            : null,
        )
      : null;

  const promptInput = buildPromptInput(
    visibleProject,
    config,
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters,
    intervention,
    previousDecision,
    currentDecision,
  );
  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
    storyConcept: concept,
    storyBible: bible,
    characters,
    volume,
    chapter,
    previousChapters,
    intervention,
    previousDecision,
    currentDecision,
  };
  const creditCheck = await requireGenerationCredits(supabase, "generate_chapter");

  if (!creditCheck.ok) {
    return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status ?? 500 });
  }

  let outputText = "";

  try {
    const result = await generateDeepSeekText({
      systemPrompt: CHAPTER_SYSTEM_PROMPT,
      userPrompt: buildChapterPrompt(promptInput),
      maxTokens: CHAPTER_MAX_TOKENS,
      temperature: CHAPTER_TEMPERATURE,
    });

    outputText = cleanChapterBody(result.outputText);
  } catch (error) {
    const errorMessage = `DeepSeek 生成失败：${getErrorMessage(error).slice(0, 800)}`;
    await writeErrorLog(errorMessage, logInput, chapterRow.id);
    return serverError(errorMessage);
  }

  if (!outputText) {
    const error = "DeepSeek 响应缺少章节正文。";
    await writeErrorLog(error, logInput, chapterRow.id);
    return serverError(error);
  }

  const draft = buildChapterDraft(outputText, model, promptInput.wordTarget, intervention);
  const summaryLogInput = {
    project: visibleProject,
    chapter,
    previousChapters,
    intervention,
    draft,
    body: outputText,
  };
  const summaryUserPrompt = buildChapterSummaryPrompt({
    chapter,
    body: outputText,
    previousSummaries: previousChapters.map((previousChapter) => ({
      ...previousChapter,
      summary: previousChapter.summary,
    })),
  });
  const summaryParseFailures: SummaryJsonParseFailure[] = [];
  let parsedSummary: unknown;
  let parsedSummarySuccessfully = false;

  for (let attempt = 1; attempt <= CHAPTER_SUMMARY_GENERATION_ATTEMPTS; attempt += 1) {
    let result: Awaited<ReturnType<typeof generateDeepSeekJson>>;

    try {
      result = await generateDeepSeekJson({
        systemPrompt: CHAPTER_SUMMARY_SYSTEM_PROMPT,
        userPrompt: summaryUserPrompt,
        maxTokens: CHAPTER_SUMMARY_MAX_TOKENS,
        temperature: CHAPTER_SUMMARY_TEMPERATURE,
      });
    } catch (error) {
      const errorMessage = `DeepSeek 摘要生成失败（第 ${attempt} 次）：${getErrorMessage(error).slice(0, 800)}`;
      const logMessage =
        summaryParseFailures.length > 0
          ? `${errorMessage}\n\n此前摘要 JSON 解析失败详情：\n${formatSummaryJsonFailureLog(summaryParseFailures)}`
          : errorMessage;

      await writeSummaryErrorLog(logMessage, summaryLogInput, chapterRow.id);
      return serverError(errorMessage);
    }

    if (!result.outputText) {
      summaryParseFailures.push(buildEmptySummaryOutputFailure(attempt, result.finishReason));
    } else {
      try {
        parsedSummary = parseSummaryJsonObject(result.outputText);
        parsedSummarySuccessfully = true;
        break;
      } catch (error) {
        summaryParseFailures.push(
          buildSummaryJsonParseFailure(attempt, result.outputText, result.finishReason, error),
        );
      }
    }

    if (attempt === CHAPTER_SUMMARY_GENERATION_ATTEMPTS) {
      const errorLog = formatSummaryJsonFailureLog(summaryParseFailures);
      await writeSummaryErrorLog(errorLog, summaryLogInput, chapterRow.id);
      return serverError("DeepSeek 摘要生成失败：AI 输出不是有效 JSON。");
    }
  }

  if (!parsedSummarySuccessfully) {
    const error = "DeepSeek 摘要生成失败：AI 输出不是有效 JSON。";
    await writeSummaryErrorLog(error, summaryLogInput, chapterRow.id);
    return serverError(error);
  }

  const summaryValidation = validateChapterSummaryOutput(parsedSummary);

  if (!summaryValidation.ok) {
    const error = `章节摘要 JSON 未通过 schema 校验：${summaryValidation.error}`;
    await writeSummaryErrorLog(error, summaryLogInput, chapterRow.id);
    return serverError(error);
  }

  const summary = buildChapterSummary(summaryValidation.summary, model);
  const { data: latestVersionRow, error: latestVersionError } = await supabase
    .from("chapter_versions")
    .select("version_number")
    .eq("project_id", visibleProject.id)
    .eq("chapter_id", chapterRow.id)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<ChapterVersionNumberRow>();

  if (latestVersionError) {
    const error = `章节版本号读取失败：${latestVersionError.message}`;
    await writeErrorLog(error, logInput, chapterRow.id);
    return serverError(error);
  }

  const nextVersionNumber = (latestVersionRow?.version_number ?? 0) + 1;
  const { data: savedVersion, error: versionError } = await supabase
    .from("chapter_versions")
    .insert({
      project_id: visibleProject.id,
      chapter_id: chapterRow.id,
      version_number: nextVersionNumber,
      body: outputText,
      summary,
      intervention,
      model,
      prompt_version: CHAPTER_PROMPT_VERSION,
    })
    .select("id,version_number")
    .single<ChapterVersionIdRow>();

  if (versionError || !savedVersion) {
    const error = versionError?.message || "章节版本保存失败。";
    await writeErrorLog(error, logInput, chapterRow.id);
    return serverError(error);
  }

  const versionedDraft = {
    ...draft,
    versionId: savedVersion.id,
  };
  const chapterContent = buildChapterContent(
    chapter,
    versionedDraft,
    summary,
    chapterRow.content,
    savedVersion.version_number,
  );

  const { data: savedChapter, error: updateError } = await supabase
    .from("chapters")
    .update({ content: chapterContent })
    .eq("id", chapterRow.id)
    .eq("project_id", visibleProject.id)
    .eq("user_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (updateError || !savedChapter) {
    const error = updateError?.message || "章节正文保存失败。";
    await supabase
      .from("chapter_versions")
      .delete()
      .eq("id", savedVersion.id)
      .eq("user_id", user.id);
    await writeErrorLog(error, logInput, chapterRow.id);
    return serverError(error);
  }

  const { data: generationLog, error: chapterLogError } = await supabase
    .from("generation_logs")
    .insert({
      project_id: visibleProject.id,
      operation: "generate_chapter",
      target_type: "chapter",
      target_id: savedChapter.id,
      model,
      prompt_version: CHAPTER_PROMPT_VERSION,
      input: logInput,
      output: {
        chapter: chapterContent,
      },
    })
    .select("id")
    .single<GenerationLogIdRow>();

  if (chapterLogError || !generationLog) {
    return serverError(
      `章节正文和摘要已保存，但生成日志写入失败：${chapterLogError?.message || "未知错误"}`,
    );
  }

  const { error: summaryLogError } = await supabase.from("generation_logs").insert({
    project_id: visibleProject.id,
    operation: "generate_chapter_summary",
    target_type: "chapter",
    target_id: savedChapter.id,
    model,
    prompt_version: CHAPTER_SUMMARY_PROMPT_VERSION,
    input: summaryLogInput,
    output: {
      summary,
    },
  });

  if (summaryLogError) {
    return serverError(`章节正文和摘要已保存，但摘要日志写入失败：${summaryLogError.message}`);
  }

  const creditSpend = await spendGenerationCredits({
    supabase,
    projectId: visibleProject.id,
    generationLogId: generationLog.id,
    operation: "generate_chapter",
    reason: "生成章节正文和摘要",
  });

  if (!creditSpend.ok) {
    return serverError(`章节正文和摘要已保存，但点数扣除失败：${creditSpend.error}`);
  }

  return NextResponse.json({
    chapterId: savedChapter.id,
    chapter: chapterContent,
    credits: {
      cost: GENERATION_CREDIT_COSTS.generate_chapter,
      balance: creditSpend.balanceAfter,
    },
  });
}
