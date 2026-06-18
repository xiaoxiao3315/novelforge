import { NextRequest, NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson, generateDeepSeekText, getDeepSeekModel } from "@/lib/ai/deepseek";
import { parseJsonObject } from "@/lib/ai/json";
import {
  GENERATION_CREDIT_COSTS,
  refundGenerationCredits,
  requireGenerationCredits,
  spendGenerationCredits,
} from "@/lib/credits";
import { isInternalAuthEnabled, requestHasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle, saveInternalChapter } from "@/lib/internal/store";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import {
  DEFAULT_FAST_REWRITE_CRITICAL_SCORE_THRESHOLD,
  DEFAULT_FAST_REWRITE_SCORE_THRESHOLD,
  runChapterQualityPipeline,
  type ChapterQualityPipelineResult,
  type QualityPipelineModel,
} from "@/lib/quality/pipeline";
import type { ChapterQualityPromptContext, ChapterWritingPlan } from "@/lib/quality/types";
import {
  validateChapterCharacterDirection,
  validateChapterFastGuidance,
  validateChapterQualityCritique,
  validateChapterWritingPlan,
} from "@/lib/quality/validators";
import {
  buildChapterDecisionGenerationLogError,
  buildChapterDecisionGenerationMetadata,
  generateChapterDecision,
  summarizeChapterDecisionGenerationFailures,
  type ChapterDecisionGenerationResult,
} from "@/lib/interactive/chapter-decision-generation";
import { createAdminClient } from "@/lib/supabase/admin";
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
  normalizeChapterContent,
  type ChapterIntervention,
  type ChapterContent,
  type ChapterPromptInput,
} from "@/prompts/chapter";
import {
  CHAPTER_DECISION_PROMPT_VERSION,
  normalizeChapterDecision,
  type ChapterDecisionPromptInput,
} from "@/prompts/chapter-decision";
import {
  buildChapterSummary,
  buildChapterSummaryPrompt,
  buildChapterSummaryRetryPrompt,
  CHAPTER_SUMMARY_PROMPT_VERSION,
  repairChapterSummaryOutput,
  type ChapterSummary,
  validateChapterSummaryOutput,
} from "@/prompts/chapter-summary";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  normalizeChapterOutlines,
  normalizeVolumeOutline,
  type ChapterOutline,
  type VolumeOutline,
} from "@/prompts/outline";
import {
  buildChapterCritiquePrompt,
  CHAPTER_CRITIQUE_SYSTEM_PROMPT,
} from "@/prompts/chapter-critique";
import {
  buildChapterCharacterDirectionPrompt,
  CHAPTER_CHARACTER_DIRECTION_SYSTEM_PROMPT,
} from "@/prompts/chapter-character-direction";
import {
  buildChapterFastGuidancePrompt,
  CHAPTER_FAST_GUIDANCE_SYSTEM_PROMPT,
} from "@/prompts/chapter-fast-guidance";
import { buildChapterPlanPrompt, CHAPTER_PLAN_SYSTEM_PROMPT } from "@/prompts/chapter-plan";
import {
  buildChapterRewritePrompt,
  CHAPTER_REWRITE_SYSTEM_PROMPT,
} from "@/prompts/chapter-rewrite";
import { normalizeInteractiveStoryState } from "@/prompts/story-state";

type GenerateChapterBody = {
  projectId?: unknown;
  chapterId?: unknown;
  chapterNumber?: unknown;
  intervention?: unknown;
  qualityMode?: unknown;
  generationSource?: unknown;
  batchRunId?: unknown;
  anchorChapterNumber?: unknown;
  routeMode?: unknown;
  routeRevision?: unknown;
  routeSnapshotHash?: unknown;
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
  volume_id: string | null;
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
const PRELOAD_RATE_LIMIT_WINDOW_MS = 60_000;
const PRELOAD_RATE_LIMIT_PER_WINDOW = 6;
const CHAPTER_SUMMARY_GENERATION_ATTEMPTS = 2;
const CHAPTER_QUALITY_JSON_GENERATION_ATTEMPTS = 2;
const CHAPTER_SUMMARY_MAX_TOKENS = 1800;
const CHAPTER_SUMMARY_TEMPERATURE = 0.1;
const CHAPTER_FAST_GUIDANCE_MAX_TOKENS = 3400;
const CHAPTER_FAST_GUIDANCE_TEMPERATURE = 0.1;
const CHAPTER_QUALITY_PLAN_MAX_TOKENS = 2600;
const CHAPTER_QUALITY_PLAN_TEMPERATURE = 0.1;
const CHAPTER_QUALITY_CHARACTER_DIRECTION_MAX_TOKENS = 2500;
const CHAPTER_QUALITY_CHARACTER_DIRECTION_TEMPERATURE = 0.1;
const CHAPTER_QUALITY_CRITIQUE_MAX_TOKENS = 2600;
const CHAPTER_QUALITY_CRITIQUE_TEMPERATURE = 0.1;
const CHAPTER_QUALITY_REWRITE_MAX_TOKENS = 7000;
const CHAPTER_QUALITY_REWRITE_TEMPERATURE = 0.68;
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

type SummarySchemaValidationFailureLog = {
  attempt: number;
  validationError: string;
  missingFields: string[];
  extraFields: string[];
  invalidFields: string[];
  retryAttempt: number | null;
  repairedFields: string[];
  rawPreview: string;
  summaryRepaired: boolean;
};

type SummaryRepairLog = {
  summaryRepaired: true;
  missingFields: string[];
  repairedFields: string[];
  rawPreview: string;
};

type SummaryFallbackLog = {
  summaryFallback: true;
  reason: string;
  rawPreview: string;
};

type ChapterSummaryPayload = Parameters<typeof buildChapterSummary>[0];

type ChapterGenerationQualityMode = "normal" | "quality";

type BatchChapterRouteMetadata = {
  generationSource: "batch-20";
  batchRunId?: string;
  routeMode: "default";
  routeRevision?: string;
  routeSnapshotHash?: string;
  qualityMode: "normal";
  isDefaultRoute: true;
};

type ReaderPreloadMetadata = {
  generationSource: "reader-preload-10";
  anchorChapterNumber: number;
  qualityMode: "normal";
};

type ChapterDraftQualityMetadata = {
  mode: "quality-v1";
  status: ChapterQualityPipelineResult["status"];
  qualityStrategy?: string;
  plan?: ChapterWritingPlan;
  characterDirection?: ChapterQualityPipelineResult["characterDirection"];
  critique: {
    overallScore: number;
    scores: NonNullable<ChapterQualityPipelineResult["critique"]>["scores"];
  };
  rewriteApplied: boolean;
  rewritePolicy: ChapterQualityPipelineResult["metadata"]["rewritePolicy"];
  rewriteScoreThreshold: number;
  criticalRewriteScoreThreshold?: number;
  rewriteDecisionReason?: string;
  promptVersions: ChapterQualityPipelineResult["metadata"]["promptVersions"];
  steps: ChapterQualityPipelineResult["steps"];
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

function normalizeQualityMode(
  value: unknown,
): { ok: true; qualityMode: ChapterGenerationQualityMode } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, qualityMode: "normal" };
  }

  if (value === "normal" || value === "quality") {
    return { ok: true, qualityMode: value };
  }

  return { ok: false, error: "qualityMode 必须是 normal 或 quality。" };
}

function readOptionalMetadataString(
  value: unknown,
  field: keyof Pick<
    GenerateChapterBody,
    "batchRunId" | "routeRevision" | "routeSnapshotHash"
  >,
  maxLength: number,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true };
  }

  if (trimmed.length > maxLength) {
    return { ok: false, error: `${field} cannot exceed ${maxLength} characters.` };
  }

  return { ok: true, value: trimmed };
}

function parseBatchRouteMetadata(
  body: GenerateChapterBody,
): { ok: true; metadata: BatchChapterRouteMetadata | null } | { ok: false; error: string } {
  const hasBatchMetadata =
    body.generationSource === "batch-20" ||
    body.batchRunId !== undefined ||
    body.routeMode !== undefined ||
    body.routeRevision !== undefined ||
    body.routeSnapshotHash !== undefined;

  if (!hasBatchMetadata) {
    return { ok: true, metadata: null };
  }

  if (body.generationSource !== "batch-20") {
    return { ok: false, error: "batch metadata requires generationSource=batch-20." };
  }

  if (body.qualityMode !== "normal") {
    return { ok: false, error: "batch-20 chapter generation requires qualityMode=normal." };
  }

  if (
    body.routeMode !== undefined &&
    body.routeMode !== null &&
    body.routeMode !== "default"
  ) {
    return { ok: false, error: "routeMode must be default." };
  }

  const batchRunId = readOptionalMetadataString(body.batchRunId, "batchRunId", 120);

  if (!batchRunId.ok) {
    return batchRunId;
  }

  const routeRevision = readOptionalMetadataString(body.routeRevision, "routeRevision", 120);

  if (!routeRevision.ok) {
    return routeRevision;
  }

  const routeSnapshotHash = readOptionalMetadataString(
    body.routeSnapshotHash,
    "routeSnapshotHash",
    160,
  );

  if (!routeSnapshotHash.ok) {
    return routeSnapshotHash;
  }

  return {
    ok: true,
    metadata: {
      generationSource: "batch-20",
      ...(batchRunId.value ? { batchRunId: batchRunId.value } : {}),
      routeMode: "default",
      ...(routeRevision.value ? { routeRevision: routeRevision.value } : {}),
      ...(routeSnapshotHash.value ? { routeSnapshotHash: routeSnapshotHash.value } : {}),
      qualityMode: "normal",
      isDefaultRoute: true,
    },
  };
}

function parseReaderPreloadMetadata(
  body: GenerateChapterBody,
): { ok: true; metadata: ReaderPreloadMetadata | null } | { ok: false; error: string } {
  if (body.generationSource === undefined || body.generationSource === "batch-20") {
    if (body.anchorChapterNumber !== undefined) {
      return {
        ok: false,
        error: "anchorChapterNumber requires generationSource=reader-preload-10.",
      };
    }

    return { ok: true, metadata: null };
  }

  if (body.generationSource !== "reader-preload-10") {
    return { ok: false, error: "generationSource must be batch-20 or reader-preload-10." };
  }

  if (body.qualityMode !== "normal") {
    return { ok: false, error: "reader-preload-10 chapter generation requires qualityMode=normal." };
  }

  if (
    body.batchRunId !== undefined ||
    body.routeMode !== undefined ||
    body.routeRevision !== undefined ||
    body.routeSnapshotHash !== undefined
  ) {
    return {
      ok: false,
      error: "reader-preload-10 cannot include batch route metadata.",
    };
  }

  const anchorChapterNumber = body.anchorChapterNumber;

  if (
    typeof anchorChapterNumber !== "number" ||
    !Number.isInteger(anchorChapterNumber) ||
    anchorChapterNumber <= 0
  ) {
    return { ok: false, error: "reader-preload-10 requires anchorChapterNumber." };
  }

  return {
    ok: true,
    metadata: {
      generationSource: "reader-preload-10",
      anchorChapterNumber,
      qualityMode: "normal",
    },
  };
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

type QualityJsonValidationResult = { ok: true } | { ok: false; error: string };

type QualityJsonValidator = (value: unknown) => QualityJsonValidationResult;

function buildQualityJsonRetryPrompt({
  label,
  originalPrompt,
  validationError,
  rawPreview,
}: {
  label: string;
  originalPrompt: string;
  validationError: string;
  rawPreview: string;
}) {
  return [
    `The previous ${label} response was not valid JSON for this schema.`,
    `Error: ${validationError}`,
    "",
    `Previous raw output preview:`,
    rawPreview,
    "",
    "Regenerate the same result now.",
    "Return only one valid JSON object.",
    "Do not use Markdown or code fences.",
    "Do not add explanations before or after the JSON.",
    "Ensure every array item is separated by a comma and all strings are properly escaped.",
    "",
    "Original task:",
    originalPrompt,
  ].join("\n");
}

async function generateQualityJsonWithRetry({
  label,
  systemPrompt,
  userPrompt,
  maxTokens,
  temperature,
  validate,
}: {
  label: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  validate?: QualityJsonValidator;
}) {
  let prompt = userPrompt;
  let lastError = "";
  let lastRawPreview = "";

  for (let attempt = 1; attempt <= CHAPTER_QUALITY_JSON_GENERATION_ATTEMPTS; attempt += 1) {
    const result = await generateDeepSeekJson({
      systemPrompt,
      userPrompt: prompt,
      maxTokens,
      temperature,
    });

    if (!result.outputText) {
      lastError = `DeepSeek ${label} response is empty.`;
      lastRawPreview = "";
    } else {
      lastRawPreview = result.outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH);

      try {
        const parsed = parseSummaryJsonObject(result.outputText);
        const validation = validate?.(parsed);

        if (!validation || validation.ok) {
          return parsed;
        }

        lastError = validation.error;
      } catch (error) {
        lastError = getErrorMessage(error);
      }
    }

    if (attempt < CHAPTER_QUALITY_JSON_GENERATION_ATTEMPTS) {
      prompt = buildQualityJsonRetryPrompt({
        label,
        originalPrompt: userPrompt,
        validationError: lastError,
        rawPreview: lastRawPreview,
      });
    }
  }

  throw new Error(
    `DeepSeek ${label} JSON failed after ${CHAPTER_QUALITY_JSON_GENERATION_ATTEMPTS} attempts: ${lastError}`,
  );
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

function buildSummarySchemaValidationFailureLog(
  attempt: number,
  outputText: string,
  validation: Extract<ReturnType<typeof validateChapterSummaryOutput>, { ok: false }>,
  retryAttempt: number | null,
): SummarySchemaValidationFailureLog {
  return {
    attempt,
    validationError: validation.error,
    missingFields: validation.missingFields,
    extraFields: validation.extraFields,
    invalidFields: validation.invalidFields,
    retryAttempt,
    repairedFields: [],
    rawPreview: outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
    summaryRepaired: false,
  };
}

function buildSummaryValidationLogOutput(
  schemaFailures: SummarySchemaValidationFailureLog[],
  parseFailures: SummaryJsonParseFailure[],
  repairLog: SummaryRepairLog | null = null,
  fallbackLog: SummaryFallbackLog | null = null,
) {
  return {
    summaryValidation: {
      attempts: schemaFailures,
      summaryRepaired: Boolean(repairLog),
      missingFields: repairLog?.missingFields ?? [],
      repairedFields: repairLog?.repairedFields ?? [],
    },
    summaryJsonParseFailures: parseFailures,
    ...(fallbackLog ? { summaryFallback: fallbackLog } : {}),
  };
}

function buildFallbackChapterSummaryPayload(
  chapter: ChapterOutline,
  body: string,
): ChapterSummaryPayload {
  const bodyPreview = body.replace(/\s+/g, " ").trim().slice(0, 180);
  const fallbackNote = bodyPreview || "正文已生成，但自动摘要暂不可用。";

  return {
    keyEvents: [chapter.event || `第 ${chapter.chapterNumber} 章正文已生成。`],
    characterStateChanges: [
      chapter.characterChange || "自动摘要生成失败，角色状态变化请以正文为准。",
    ],
    relationshipChanges: ["自动摘要生成失败，关系变化请以正文为准。"],
    foreshadowingAndClues: [
      chapter.foreshadowing || "自动摘要生成失败，伏笔线索请以正文为准。",
    ],
    unresolvedQuestions: [
      chapter.endingHook || "自动摘要生成失败，未解悬念请以正文为准。",
    ],
    endingState: `自动摘要生成失败，已保留正文。正文预览：${fallbackNote}`,
    continuityNotes: [`下一章生成请优先参考第 ${chapter.chapterNumber} 章完整正文。`],
  };
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
  interactiveState: ChapterPromptInput["interactiveState"],
): ChapterPromptInput {
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
    volume,
    chapter,
    previousChapters,
    intervention,
    previousDecision,
    currentDecision,
    interactiveState,
    wordTarget: chapter.estimatedWords || DEFAULT_CHAPTER_WORD_TARGET,
  };
}

function formatDecisionSummaryText(chapter: ReturnType<typeof buildPreviousChapterContext>) {
  if (chapter.summary) {
    return [
      ...chapter.summary.keyEvents,
      ...chapter.summary.characterStateChanges,
      ...chapter.summary.unresolvedQuestions,
    ].join("；");
  }

  return chapter.draftExcerpt;
}

function buildDecisionPreviousChapters(
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[],
): ChapterDecisionPromptInput["previousChapters"] {
  return previousChapters.map((chapter) => ({
    ...chapter,
    summaryText: formatDecisionSummaryText(chapter),
  }));
}

function buildDecisionPromptInput({
  bible,
  chapter,
  characters,
  config,
  concept,
  currentChapterBody,
  previousChapters,
  project,
  volume,
}: {
  bible: StoryBible;
  chapter: ChapterOutline;
  characters: CharacterCard[];
  config: StoryConfigRow;
  concept: StoryConcept;
  currentChapterBody?: string | null;
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[];
  project: ProjectRow;
  volume: VolumeOutline;
}): ChapterDecisionPromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: buildStoryConfigPromptData(config),
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters: buildDecisionPreviousChapters(previousChapters),
    currentChapterBody: currentChapterBody ?? null,
  };
}

function buildDecisionGenerationSummary(result: ChapterDecisionGenerationResult | null) {
  if (!result) {
    return null;
  }

  if (result.ok) {
    return {
      status: "success" as const,
      question: result.decision.question,
      optionLabels: result.decision.options.map((option) => `${option.id}. ${option.label}`),
      failedAttempts: result.failures.length,
    };
  }

  return {
    status: "failed" as const,
    error: result.error,
    failures: summarizeChapterDecisionGenerationFailures(result.failures),
  };
}

function withFreshInteractiveDecisionContent({
  baseContent,
  decisionResult,
}: {
  baseContent: ChapterContent;
  decisionResult: ChapterDecisionGenerationResult | null;
}): ChapterContent {
  const contentWithoutOldDecision = { ...baseContent };
  delete contentWithoutOldDecision.decision;
  delete contentWithoutOldDecision.decisionGeneration;
  delete contentWithoutOldDecision.stateChanges;

  if (!decisionResult) {
    return contentWithoutOldDecision;
  }

  if (decisionResult.ok) {
    return {
      ...contentWithoutOldDecision,
      decision: decisionResult.decision,
      decisionGeneration: buildChapterDecisionGenerationMetadata({
        source: "auto-chapter-generation",
      }),
    };
  }

  return {
    ...contentWithoutOldDecision,
    decisionGeneration: buildChapterDecisionGenerationMetadata({
      error: decisionResult.error,
      source: "auto-chapter-generation",
    }),
  };
}

function withoutStaleRouteMetadata(content: ChapterContent): ChapterContent {
  const nextContent = { ...content };

  delete nextContent.routeMetadata;
  delete nextContent.needsRegeneration;
  delete nextContent.stale;

  return nextContent;
}

function withoutReadBilling(content: ChapterContent): ChapterContent {
  const nextContent = { ...content };

  delete nextContent.readBilling;

  return nextContent;
}

function redactChapterBodies(content: ChapterContent): ChapterContent {
  return {
    ...content,
    ...(content.draft ? { draft: { ...content.draft, body: "" } } : {}),
    ...(content.official ? { official: { ...content.official, body: "" } } : {}),
  };
}

function hasUnlockedReadableBody(content: unknown) {
  const chapter = normalizeChapterContent(content);

  return Boolean(
    chapter &&
      !chapter.needsRegeneration &&
      !chapter.stale &&
      (chapter.official?.body || chapter.draft?.body) &&
      (!chapter.readBilling || chapter.readBilling.state === "charged"),
  );
}

// 质量流水线的 5 个提示词都会整体序列化 storyContext。
// 不加窗口的话，前文摘要 + 正文节选会随章节数无限膨胀（且每次精修放大 5 倍成本）。
// 策略：最近 8 章保留完整上下文（含正文节选），再往前 16 章只保留摘要，更早的丢弃
// （长线设定靠 story_bible/伏笔字段维系；正文生成主提示词另有全量压缩前情）。
const QUALITY_CONTEXT_EXCERPT_WINDOW = 8;
const QUALITY_CONTEXT_SUMMARY_WINDOW = 24;

function buildQualityPreviousSummaries(
  previousChapters: ChapterPromptInput["previousChapters"],
): ChapterPromptInput["previousChapters"] {
  if (previousChapters.length <= QUALITY_CONTEXT_EXCERPT_WINDOW) {
    return previousChapters;
  }

  const recent = previousChapters.slice(-QUALITY_CONTEXT_EXCERPT_WINDOW);
  const older = previousChapters
    .slice(-QUALITY_CONTEXT_SUMMARY_WINDOW, -QUALITY_CONTEXT_EXCERPT_WINDOW)
    .map((chapter) => ({ ...chapter, draftExcerpt: null }));

  return [...older, ...recent];
}

function buildChapterQualityContext(input: ChapterPromptInput): ChapterQualityPromptContext {
  return {
    storyConfig: input.config,
    storyConcept: input.concept,
    storyBible: input.bible,
    characters: input.characters,
    volume: input.volume,
    chapterOutline: input.chapter,
    previousSummaries: buildQualityPreviousSummaries(input.previousChapters),
    directorInstruction: input.intervention,
    interactiveDecision: {
      previousDecision: input.previousDecision ?? null,
      currentDecision: input.currentDecision ?? null,
    },
    interactiveState: input.interactiveState ?? null,
  };
}

function createQualityPipelineModel(promptInput: ChapterPromptInput): QualityPipelineModel {
  return {
    async generateGuidance(input) {
      return generateQualityJsonWithRetry({
        label: "fast chapter guidance",
        systemPrompt: CHAPTER_FAST_GUIDANCE_SYSTEM_PROMPT,
        userPrompt: buildChapterFastGuidancePrompt(input),
        maxTokens: CHAPTER_FAST_GUIDANCE_MAX_TOKENS,
        temperature: CHAPTER_FAST_GUIDANCE_TEMPERATURE,
        validate: validateChapterFastGuidance,
      });
    },
    async generatePlan(input) {
      return generateQualityJsonWithRetry({
        label: "chapter plan",
        systemPrompt: CHAPTER_PLAN_SYSTEM_PROMPT,
        userPrompt: buildChapterPlanPrompt(input),
        maxTokens: CHAPTER_QUALITY_PLAN_MAX_TOKENS,
        temperature: CHAPTER_QUALITY_PLAN_TEMPERATURE,
        validate: validateChapterWritingPlan,
      });
    },
    async generateCharacterDirection(input) {
      return generateQualityJsonWithRetry({
        label: "character direction",
        systemPrompt: CHAPTER_CHARACTER_DIRECTION_SYSTEM_PROMPT,
        userPrompt: buildChapterCharacterDirectionPrompt(input),
        maxTokens: CHAPTER_QUALITY_CHARACTER_DIRECTION_MAX_TOKENS,
        temperature: CHAPTER_QUALITY_CHARACTER_DIRECTION_TEMPERATURE,
        validate: validateChapterCharacterDirection,
      });
    },
    async generateDraft(input) {
      const result = await generateDeepSeekText({
        systemPrompt: CHAPTER_SYSTEM_PROMPT,
        userPrompt: buildChapterPrompt({
          ...promptInput,
          chapterPlan: input.chapterPlan ?? null,
          chapterCharacterDirection: input.chapterCharacterDirection ?? null,
        }),
        maxTokens: CHAPTER_MAX_TOKENS,
        temperature: CHAPTER_TEMPERATURE,
      });

      return cleanChapterBody(result.outputText);
    },
    async generateCritique(input) {
      return generateQualityJsonWithRetry({
        label: "quality critique",
        systemPrompt: CHAPTER_CRITIQUE_SYSTEM_PROMPT,
        userPrompt: buildChapterCritiquePrompt(input),
        maxTokens: CHAPTER_QUALITY_CRITIQUE_MAX_TOKENS,
        temperature: CHAPTER_QUALITY_CRITIQUE_TEMPERATURE,
        validate: validateChapterQualityCritique,
      });
    },
    async generateRewrite(input) {
      const result = await generateDeepSeekText({
        systemPrompt: CHAPTER_REWRITE_SYSTEM_PROMPT,
        userPrompt: buildChapterRewritePrompt(input),
        maxTokens: CHAPTER_QUALITY_REWRITE_MAX_TOKENS,
        temperature: CHAPTER_QUALITY_REWRITE_TEMPERATURE,
      });

      return cleanChapterBody(result.outputText);
    },
  };
}

function buildQualityPromptVersions(pipelineResult: ChapterQualityPipelineResult) {
  return pipelineResult.metadata.promptVersions;
}

function buildQualityMetadata(
  pipelineResult: ChapterQualityPipelineResult,
): ChapterDraftQualityMetadata | null {
  if (!pipelineResult.critique) {
    return null;
  }

  return {
    mode: pipelineResult.metadata.mode,
    status: pipelineResult.status,
    qualityStrategy: pipelineResult.metadata.promptVersions.guidance
      ? "fast-guidance-v1"
      : "multi-agent-v1",
    ...(pipelineResult.plan ? { plan: pipelineResult.plan } : {}),
    ...(pipelineResult.characterDirection
      ? { characterDirection: pipelineResult.characterDirection }
      : {}),
    critique: {
      overallScore: pipelineResult.critique.overallScore,
      scores: pipelineResult.critique.scores,
    },
    rewriteApplied: pipelineResult.steps.rewrite === "success",
    rewritePolicy: pipelineResult.metadata.rewritePolicy,
    rewriteScoreThreshold: pipelineResult.metadata.rewriteScoreThreshold,
    criticalRewriteScoreThreshold: pipelineResult.metadata.criticalRewriteScoreThreshold,
    ...(pipelineResult.metadata.rewriteDecisionReason
      ? { rewriteDecisionReason: pipelineResult.metadata.rewriteDecisionReason }
      : {}),
    promptVersions: buildQualityPromptVersions(pipelineResult),
    steps: pipelineResult.steps,
  };
}

function summarizeChapterPlan(plan: ChapterWritingPlan | undefined) {
  if (!plan) {
    return null;
  }

  return {
    chapterGoal: plan.chapterGoal,
    coreConflict: plan.coreConflict,
    emotionalArc: plan.emotionalArc,
    endingHook: plan.endingHook,
    keySceneCount: plan.keyScenes.length,
    characterBeatCount: plan.characterBeats.length,
    suspenseAndHooks: plan.suspenseAndHooks.slice(0, 3),
    mustAvoid: plan.mustAvoid.slice(0, 3),
    continuityNotes: plan.continuityNotes.slice(0, 3),
  };
}

function summarizeChapterCharacterDirection(
  characterDirection: ChapterQualityPipelineResult["characterDirection"],
) {
  if (!characterDirection) {
    return null;
  }

  return {
    povGuidance: characterDirection.povGuidance,
    focusCharacterCount: characterDirection.focusCharacters.length,
    focusCharacters: characterDirection.focusCharacters.slice(0, 5).map((character) => ({
      character: character.character,
      activeDesire: character.activeDesire,
      emotionalMask: character.emotionalMask,
      dialogueVoice: character.dialogueVoice,
      relationshipPressure: character.relationshipPressure,
    })),
    relationshipBeats: characterDirection.relationshipBeats.slice(0, 3),
    dialogueRules: characterDirection.dialogueRules.slice(0, 3),
    actionRules: characterDirection.actionRules.slice(0, 3),
    hiddenInformation: characterDirection.hiddenInformation.slice(0, 3),
    continuityGuards: characterDirection.continuityGuards.slice(0, 3),
    mustInclude: characterDirection.mustInclude.slice(0, 3),
    mustAvoid: characterDirection.mustAvoid.slice(0, 3),
  };
}

function summarizeQualityPipelineResult(pipelineResult: ChapterQualityPipelineResult) {
  return {
    status: pipelineResult.status,
    steps: pipelineResult.steps,
    errors: pipelineResult.errors,
    plan: summarizeChapterPlan(pipelineResult.plan),
    characterDirection: summarizeChapterCharacterDirection(pipelineResult.characterDirection),
    critique: pipelineResult.critique
      ? {
          overallScore: pipelineResult.critique.overallScore,
          scores: pipelineResult.critique.scores,
        }
      : null,
    rewriteApplied: pipelineResult.steps.rewrite === "success",
    rewritePolicy: pipelineResult.metadata.rewritePolicy,
    rewriteScoreThreshold: pipelineResult.metadata.rewriteScoreThreshold,
    criticalRewriteScoreThreshold: pipelineResult.metadata.criticalRewriteScoreThreshold,
    rewriteDecisionReason: pipelineResult.metadata.rewriteDecisionReason ?? null,
    promptVersions: buildQualityPromptVersions(pipelineResult),
  };
}

function withQualityLogInput(
  logInput: Record<string, unknown>,
  qualityMode: ChapterGenerationQualityMode,
  pipelineResult?: ChapterQualityPipelineResult | null,
) {
  if (qualityMode === "normal") {
    return logInput;
  }

  return {
    ...logInput,
    qualityMode,
    ...(pipelineResult
      ? { qualityPipeline: summarizeQualityPipelineResult(pipelineResult) }
      : {}),
  };
}

async function buildInternalChapterSummary({
  chapter,
  outputText,
  previousChapters,
  model,
}: {
  chapter: ChapterOutline;
  outputText: string;
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[];
  model: string;
}): Promise<ChapterSummary> {
  const summaryUserPrompt = buildChapterSummaryPrompt({
    chapter,
    body: outputText,
    previousSummaries: previousChapters.map((previousChapter) => ({
      ...previousChapter,
      summary: previousChapter.summary,
    })),
  });
  let parsedSummary: unknown;
  let parsedSummaryOutputText = "";
  let summaryPrompt = summaryUserPrompt;

  for (let attempt = 1; attempt <= CHAPTER_SUMMARY_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const result = await generateDeepSeekJson({
        systemPrompt: CHAPTER_SUMMARY_SYSTEM_PROMPT,
        userPrompt: summaryPrompt,
        maxTokens: CHAPTER_SUMMARY_MAX_TOKENS,
        temperature: CHAPTER_SUMMARY_TEMPERATURE,
      });

      if (!result.outputText) {
        continue;
      }

      parsedSummary = parseSummaryJsonObject(result.outputText);
      parsedSummaryOutputText = result.outputText;

      const validation = validateChapterSummaryOutput(parsedSummary);

      if (validation.ok) {
        return buildChapterSummary(validation.summary, model);
      }

      if (attempt < CHAPTER_SUMMARY_GENERATION_ATTEMPTS) {
        summaryPrompt = buildChapterSummaryRetryPrompt({
          originalPrompt: summaryUserPrompt,
          validationError: validation.error,
          missingFields: validation.missingFields,
          rawPreview: result.outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
        });
      }
    } catch {
      // Keep internal generation usable even when summary JSON needs fallback.
    }
  }

  const repair = repairChapterSummaryOutput(parsedSummary);

  if (repair.ok) {
    return buildChapterSummary(repair.summary, model);
  }

  return buildChapterSummary(
    buildFallbackChapterSummaryPayload(chapter, outputText || parsedSummaryOutputText),
    model,
  );
}

async function generateInternalChapter(body: GenerateChapterBody) {
  const batchRouteMetadataValidation = parseBatchRouteMetadata(body);

  if (!batchRouteMetadataValidation.ok) {
    return validationError(batchRouteMetadataValidation.error);
  }

  const batchRouteMetadata = batchRouteMetadataValidation.metadata;
  const readerPreloadMetadataValidation = parseReaderPreloadMetadata(body);

  if (!readerPreloadMetadataValidation.ok) {
    return validationError(readerPreloadMetadataValidation.error);
  }

  const readerPreloadMetadata = readerPreloadMetadataValidation.metadata;
  const qualityModeValidation = normalizeQualityMode(body.qualityMode);

  if (!qualityModeValidation.ok) {
    return validationError(qualityModeValidation.error);
  }

  const { qualityMode } = qualityModeValidation;
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
    return validationError("Missing project.");
  }

  if (!chapterId && !chapterNumber) {
    return validationError("Missing chapter outline.");
  }

  const bundle = await getInternalProjectBundle(projectId);

  if (!bundle || !bundle.config) {
    return validationError("Missing project.");
  }

  const visibleProject: ProjectRow = {
    id: bundle.project.id,
    title: bundle.project.title,
    description: bundle.project.description,
  };
  const config = bundle.config as StoryConfigRow;
  const model = getDeepSeekModel();
  const concept = normalizeStoryConcept(bundle.concept);

  if (!concept) {
    return validationError("Missing story_concept.");
  }

  const bible = normalizeStoryBible(bundle.bible);

  if (!bible) {
    return validationError("Missing story_bible.");
  }

  const characters = normalizeCharacterCards(bundle.characters);

  if (characters.length === 0) {
    return validationError("Missing characters.");
  }

  const chapterRow =
    (chapterId ? bundle.chapters.find((row) => row.id === chapterId) : null) ??
    (chapterNumber
      ? bundle.chapters.find((row) => row.chapter_number === chapterNumber)
      : null);
  const chapter = chapterRow ? normalizeChapterOutlines([chapterRow.content])[0] ?? null : null;

  if (!chapterRow || !chapter) {
    return validationError("Missing chapter outline.");
  }

  if (!chapterRow.volume_id) {
    return validationError("Missing chapter volume.");
  }

  const volumeRow = bundle.volumes.find((row) => row.id === chapterRow.volume_id);
  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    return validationError("Missing volume.");
  }

  const previousRows = bundle.chapters
    .filter((row) => row.chapter_number < chapter.chapterNumber)
    .sort((left, right) => left.chapter_number - right.chapter_number);
  const previousChapters = previousRows
    .map((row) => {
      const outline = normalizeChapterOutlines([row.content])[0] ?? null;
      return outline ? buildPreviousChapterContext(outline, row.content) : null;
    })
    .filter((item): item is ReturnType<typeof buildPreviousChapterContext> => Boolean(item));
  const projectMode = getProjectModeFromConfig(config.config_json);

  if (readerPreloadMetadata) {
    if (projectMode !== "interactive") {
      return validationError("reader-preload-10 only supports interactive projects.");
    }

    const { anchorChapterNumber } = readerPreloadMetadata;

    if (
      chapter.chapterNumber <= anchorChapterNumber ||
      chapter.chapterNumber > anchorChapterNumber + 10
    ) {
      return validationError("reader-preload-10 can only generate the next 10 chapters from the anchor.");
    }

    const anchorChapterRow = previousRows.find(
      (row) => row.chapter_number === anchorChapterNumber,
    );

    if (!anchorChapterRow || !hasUnlockedReadableBody(anchorChapterRow.content)) {
      return validationError("reader-preload-10 requires a readable unlocked anchor chapter.");
    }

    const existingPreloadContent = normalizeChapterContent(chapterRow.content);

    if (
      existingPreloadContent &&
      !existingPreloadContent.needsRegeneration &&
      !existingPreloadContent.stale &&
      (existingPreloadContent.official?.body || existingPreloadContent.draft?.body)
    ) {
      return NextResponse.json({
        chapterId: chapterRow.id,
        chapter: existingPreloadContent,
        alreadyGenerated: true,
        credits: {
          cost: 0,
          balance: 9999,
        },
      });
    }
  }

  const previousDecisionRow = previousRows.find(
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
  const interactiveState =
    projectMode === "interactive" && isRecord(config.config_json)
      ? normalizeInteractiveStoryState(
          (config.config_json as { interactiveState?: unknown }).interactiveState,
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
    null,
    interactiveState,
  );
  let outputText = "";
  let qualityPipelineResult: ChapterQualityPipelineResult | null = null;
  let qualityMetadata: ChapterDraftQualityMetadata | null = null;

  if (qualityMode === "quality") {
    const qualityPipelineInput = {
      storyContext: buildChapterQualityContext(promptInput),
      draftSource: "generate",
      rewritePolicy: "score-threshold",
      rewriteScoreThreshold: DEFAULT_FAST_REWRITE_SCORE_THRESHOLD,
      criticalRewriteScoreThreshold: DEFAULT_FAST_REWRITE_CRITICAL_SCORE_THRESHOLD,
      enableFastGuidance: true,
    } satisfies Parameters<typeof runChapterQualityPipeline>[0];

    qualityPipelineResult = await runChapterQualityPipeline(
      qualityPipelineInput,
      createQualityPipelineModel(promptInput),
    );
    qualityMetadata = buildQualityMetadata(qualityPipelineResult);

    if (qualityPipelineResult.status !== "success" || !qualityPipelineResult.finalText) {
      const errorMessage =
        qualityPipelineResult.errors.at(-1)?.message ||
        "Quality pipeline failed before producing final chapter text.";
      return serverError(`High quality chapter generation failed: ${errorMessage.slice(0, 800)}`);
    }

    outputText = cleanChapterBody(qualityPipelineResult.finalText);
  } else {
    try {
      const result = await generateDeepSeekText({
        systemPrompt: CHAPTER_SYSTEM_PROMPT,
        userPrompt: buildChapterPrompt(promptInput),
        maxTokens: CHAPTER_MAX_TOKENS,
        temperature: CHAPTER_TEMPERATURE,
      });

      outputText = cleanChapterBody(result.outputText);
    } catch (error) {
      return serverError(`DeepSeek generation failed: ${getErrorMessage(error).slice(0, 800)}`);
    }
  }

  if (!outputText) {
    return serverError("DeepSeek response did not include chapter body.");
  }

  const existingContent = normalizeChapterContent(chapterRow.content);
  const nextVersionCount = (existingContent?.versionCount ?? 0) + 1;
  const baseDraft = buildChapterDraft(outputText, model, promptInput.wordTarget, intervention);
  const draft = {
    ...baseDraft,
    versionId: `internal-${nextVersionCount}-${crypto.randomUUID()}`,
    ...(qualityMetadata ? { quality: qualityMetadata } : {}),
    ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
  };
  const shouldGenerateAutoDecision =
    process.env.ENABLE_AUTO_CHAPTER_DECISION === "true" && projectMode === "interactive";
  const autoDecisionPromise =
    shouldGenerateAutoDecision
      ? generateChapterDecision(
          buildDecisionPromptInput({
            bible,
            chapter,
            characters,
            config,
            concept,
            currentChapterBody: outputText,
            previousChapters,
            project: visibleProject,
            volume,
          }),
        )
      : null;
  const summary = await buildInternalChapterSummary({
    chapter,
    outputText,
    previousChapters,
    model,
  });
  const autoDecisionResult = autoDecisionPromise ? await autoDecisionPromise : null;
  const autoDecisionSummary = buildDecisionGenerationSummary(autoDecisionResult);
  const baseChapterContent = buildChapterContent(
    chapter,
    draft,
    summary,
    chapterRow.content,
    nextVersionCount,
  );
  const routedBaseChapterContent = batchRouteMetadata
    ? baseChapterContent
    : withoutStaleRouteMetadata(baseChapterContent);
  const decisionChapterContent =
    projectMode === "interactive"
      ? withFreshInteractiveDecisionContent({
          baseContent: routedBaseChapterContent,
          decisionResult: autoDecisionResult,
        })
      : routedBaseChapterContent;
  const chapterContent = batchRouteMetadata
    ? {
        ...withoutReadBilling(decisionChapterContent),
        routeMetadata: batchRouteMetadata,
      }
    : withoutReadBilling(decisionChapterContent);
  const savedChapter = await saveInternalChapter(projectId, chapterRow.id, chapterContent);

  if (!savedChapter) {
    return serverError("Chapter body save failed.");
  }

  return NextResponse.json({
    chapterId: savedChapter.id,
    chapter: chapterContent,
    ...(autoDecisionSummary ? { autoDecision: autoDecisionSummary } : {}),
    ...(qualityMode === "quality" && qualityPipelineResult
      ? { quality: summarizeQualityPipelineResult(qualityPipelineResult) }
      : {}),
    credits: {
      cost: 0,
      balance: 9999,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as GenerateChapterBody | null;

  if (!body || typeof body !== "object") {
    return validationError("è¯·æ±‚æ ¼å¼ä¸æ­£ç¡®ã€‚");
  }

  if ("user_id" in body) {
    return validationError("ç”Ÿæˆç« èŠ‚æ­£æ–‡æ—¶ä¸èƒ½ä»Žå‰ç«¯ä¼  user_idã€‚");
  }

  if (isInternalAuthEnabled()) {
    if (!requestHasInternalSession(request)) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    return generateInternalChapter(body);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const userId = user.id;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成章节正文时不能从前端传 user_id。");
  }

  const batchRouteMetadataValidation = parseBatchRouteMetadata(body);

  if (!batchRouteMetadataValidation.ok) {
    return validationError(batchRouteMetadataValidation.error);
  }

  const batchRouteMetadata = batchRouteMetadataValidation.metadata;
  const readerPreloadMetadataValidation = parseReaderPreloadMetadata(body);

  if (!readerPreloadMetadataValidation.ok) {
    return validationError(readerPreloadMetadataValidation.error);
  }

  const readerPreloadMetadata = readerPreloadMetadataValidation.metadata;
  const qualityModeValidation = normalizeQualityMode(body.qualityMode);

  if (!qualityModeValidation.ok) {
    return validationError(qualityModeValidation.error);
  }

  const { qualityMode } = qualityModeValidation;
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
    .eq("user_id", user.id)
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
    output?: Record<string, unknown>,
  ) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation,
      target_type: "chapter",
      ...(targetId ? { target_id: targetId } : {}),
      model,
      prompt_version: promptVersion,
      input,
      ...(output ? { output } : {}),
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
    output?: Record<string, unknown>,
  ) {
    await writeGenerationErrorLog(
      "generate_chapter_summary",
      CHAPTER_SUMMARY_PROMPT_VERSION,
      error,
      input,
      targetId,
      output,
    );
  }

  const baseLogInput = withQualityLogInput(
    {
      project: visibleProject,
      intervention,
      ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
      ...(readerPreloadMetadata ? { preloadMetadata: readerPreloadMetadata } : {}),
    },
    qualityMode,
  );

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

  let chapterQuery = supabase
    .from("chapters")
    .select(
      "id,volume_id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
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

  if (!chapterRow.volume_id) {
    const error = "缺少 chapter volume。";
    await writeErrorLog(error, baseLogInput, chapterRow.id);
    return validationError(error);
  }

  const { data: volumeRow, error: volumeError } = await supabase
    .from("volumes")
    .select("content")
    .eq("project_id", projectId)
    .eq("id", chapterRow.volume_id)
    .maybeSingle<VolumeRow>();

  if (volumeError) {
    await writeErrorLog(volumeError.message, baseLogInput, chapterRow.id);
    return serverError(volumeError.message);
  }

  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    const error = "缺少 volume。";
    await writeErrorLog(error, baseLogInput, chapterRow.id);
    return validationError(error);
  }

  const { data: previousRows, error: previousError } = await supabase
    .from("chapters")
    .select(
      "id,volume_id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
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

  if (readerPreloadMetadata) {
    if (projectMode !== "interactive") {
      const error = "reader-preload-10 only supports interactive projects.";
      await writeErrorLog(error, baseLogInput, chapterRow.id);
      return validationError(error);
    }

    const { anchorChapterNumber } = readerPreloadMetadata;

    if (
      chapter.chapterNumber <= anchorChapterNumber ||
      chapter.chapterNumber > anchorChapterNumber + 10
    ) {
      const error = "reader-preload-10 can only generate the next 10 chapters from the anchor.";
      await writeErrorLog(error, baseLogInput, chapterRow.id);
      return validationError(error);
    }

    const anchorChapterRow = (previousRows ?? []).find(
      (row) => row.chapter_number === anchorChapterNumber,
    );

    if (!anchorChapterRow || !hasUnlockedReadableBody(anchorChapterRow.content)) {
      const error = "reader-preload-10 requires a readable unlocked anchor chapter.";
      await writeErrorLog(error, baseLogInput, chapterRow.id);
      return validationError(error);
    }

    // 幂等保护：目标章节已有可用正文（含未解锁缓存）时直接返回，
    // 不再免费消耗 AI 重复生成，也不在响应中泄露未付费正文。
    const existingPreloadContent = normalizeChapterContent(chapterRow.content);

    if (
      existingPreloadContent &&
      !existingPreloadContent.needsRegeneration &&
      !existingPreloadContent.stale &&
      (existingPreloadContent.official?.body || existingPreloadContent.draft?.body)
    ) {
      const redactedExisting: ChapterContent = {
        ...existingPreloadContent,
        ...(existingPreloadContent.draft
          ? { draft: { ...existingPreloadContent.draft, body: "" } }
          : {}),
        ...(existingPreloadContent.official
          ? { official: { ...existingPreloadContent.official, body: "" } }
          : {}),
      };

      return NextResponse.json({
        chapterId: chapterRow.id,
        chapter: redactedExisting,
        alreadyGenerated: true,
        credits: {
          cost: 0,
          deferredCost:
            existingPreloadContent.readBilling?.state === "unclaimed"
              ? GENERATION_CREDIT_COSTS.claim_read_chapter
              : 0,
          balance: null,
        },
      });
    }

    // 频控：后台缓存生成是平台先行垫付 AI 成本的免费操作，
    // 按用户在最近一分钟内的章节生成次数限流（客户端正常节奏约 5 次/分钟）。
    const windowStartIso = new Date(
      Date.now() - PRELOAD_RATE_LIMIT_WINDOW_MS,
    ).toISOString();
    const { count: recentGenerationCount, error: rateLimitError } = await supabase
      .from("generation_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("operation", "generate_chapter")
      .gte("created_at", windowStartIso);

    if (!rateLimitError && (recentGenerationCount ?? 0) >= PRELOAD_RATE_LIMIT_PER_WINDOW) {
      return NextResponse.json(
        { error: "后台缓存生成过于频繁，请稍后再试。" },
        { status: 429 },
      );
    }
  }

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
  const currentDecision = null;
  const interactiveState =
    projectMode === "interactive" && isRecord(config.config_json)
      ? normalizeInteractiveStoryState(
          (config.config_json as { interactiveState?: unknown }).interactiveState,
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
    interactiveState,
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
    interactiveState,
    ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
    ...(readerPreloadMetadata ? { preloadMetadata: readerPreloadMetadata } : {}),
  };
  const creditOperation =
    qualityMode === "quality" ? "generate_chapter_quality" : "generate_chapter";
  const shouldDeferReadBilling = Boolean(readerPreloadMetadata);
  const creditCheck = shouldDeferReadBilling
    ? null
    : await requireGenerationCredits(supabase, creditOperation);

  if (creditCheck && !creditCheck.ok) {
    return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status ?? 500 });
  }

  let outputText = "";
  let qualityPipelineResult: ChapterQualityPipelineResult | null = null;
  let qualityMetadata: ChapterDraftQualityMetadata | null = null;

  if (qualityMode === "quality") {
    const qualityPipelineInput = {
      storyContext: buildChapterQualityContext(promptInput),
      draftSource: "generate",
      rewritePolicy: "score-threshold",
      rewriteScoreThreshold: DEFAULT_FAST_REWRITE_SCORE_THRESHOLD,
      criticalRewriteScoreThreshold: DEFAULT_FAST_REWRITE_CRITICAL_SCORE_THRESHOLD,
      enableFastGuidance: true,
    } satisfies Parameters<typeof runChapterQualityPipeline>[0];

    qualityPipelineResult = await runChapterQualityPipeline(
      qualityPipelineInput,
      createQualityPipelineModel(promptInput),
    );
    qualityMetadata = buildQualityMetadata(qualityPipelineResult);

    if (qualityPipelineResult.status !== "success" || !qualityPipelineResult.finalText) {
      const errorMessage =
        qualityPipelineResult.errors.at(-1)?.message ||
        "Quality pipeline failed before producing final chapter text.";
      await writeErrorLog(
        `高质量章节生成失败：${errorMessage.slice(0, 800)}`,
        withQualityLogInput(logInput, qualityMode, qualityPipelineResult),
        chapterRow.id,
      );
      return serverError(`高质量章节生成失败：${errorMessage.slice(0, 800)}`);
    }

    outputText = cleanChapterBody(qualityPipelineResult.finalText);
  } else {
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
  }

  if (!outputText) {
    const error = "DeepSeek 响应缺少章节正文。";
    await writeErrorLog(
      error,
      withQualityLogInput(logInput, qualityMode, qualityPipelineResult),
      chapterRow.id,
    );
    return serverError(error);
  }

  const baseDraft = buildChapterDraft(outputText, model, promptInput.wordTarget, intervention);
  const draft = {
    ...baseDraft,
    ...(qualityMetadata ? { quality: qualityMetadata } : {}),
    ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
  };
  const summaryLogInput = {
    project: visibleProject,
    chapter,
    previousChapters,
    intervention,
    draft,
    body: outputText,
    ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
    ...(readerPreloadMetadata ? { preloadMetadata: readerPreloadMetadata } : {}),
    ...(qualityMode === "quality"
      ? {
          qualityMode,
          qualityPipeline: qualityPipelineResult
            ? summarizeQualityPipelineResult(qualityPipelineResult)
            : null,
        }
      : {}),
  };
  // 互动模式下章节生成后自动附带命运分歧的开关。
  // 默认关闭：分歧由读者在章节结尾按需生成，避免为未读章节多付一次 AI 成本。
  const shouldGenerateAutoDecision =
    process.env.ENABLE_AUTO_CHAPTER_DECISION === "true" && projectMode === "interactive";
  const autoDecisionPromise =
    shouldGenerateAutoDecision
      ? generateChapterDecision(
          buildDecisionPromptInput({
            bible,
            chapter,
            characters,
            config,
            concept,
            currentChapterBody: outputText,
            previousChapters,
            project: visibleProject,
            volume,
          }),
        )
      : null;
  const summaryUserPrompt = buildChapterSummaryPrompt({
    chapter,
    body: outputText,
    previousSummaries: previousChapters.map((previousChapter) => ({
      ...previousChapter,
      summary: previousChapter.summary,
    })),
  });
  const summaryParseFailures: SummaryJsonParseFailure[] = [];
  const summarySchemaFailures: SummarySchemaValidationFailureLog[] = [];
  let parsedSummary: unknown;
  let parsedSummaryOutputText = "";
  let summaryValidation: ReturnType<typeof validateChapterSummaryOutput> | null = null;
  let summaryFallbackLog: SummaryFallbackLog | null = null;
  let summaryRepairLog: SummaryRepairLog | null = null;
  let summaryPrompt = summaryUserPrompt;

  for (let attempt = 1; attempt <= CHAPTER_SUMMARY_GENERATION_ATTEMPTS; attempt += 1) {
    let result: Awaited<ReturnType<typeof generateDeepSeekJson>>;

    try {
      result = await generateDeepSeekJson({
        systemPrompt: CHAPTER_SUMMARY_SYSTEM_PROMPT,
        userPrompt: summaryPrompt,
        maxTokens: CHAPTER_SUMMARY_MAX_TOKENS,
        temperature: CHAPTER_SUMMARY_TEMPERATURE,
      });
    } catch (error) {
      const errorMessage = `DeepSeek 摘要生成失败（第 ${attempt} 次）：${getErrorMessage(error).slice(0, 800)}`;
      const logMessage =
        summaryParseFailures.length > 0 || summarySchemaFailures.length > 0
          ? `${errorMessage}\n\n此前摘要 JSON 解析失败详情：\n${formatSummaryJsonFailureLog(summaryParseFailures)}`
          : errorMessage;

      await writeSummaryErrorLog(
        logMessage,
        summaryLogInput,
        chapterRow.id,
        buildSummaryValidationLogOutput(summarySchemaFailures, summaryParseFailures, null, {
          summaryFallback: true,
          reason: errorMessage,
          rawPreview: "",
        }),
      );
      summaryFallbackLog = {
        summaryFallback: true,
        reason: errorMessage,
        rawPreview: "",
      };
      summaryValidation = {
        ok: true,
        summary: buildFallbackChapterSummaryPayload(chapter, outputText),
      };
      break;
    }

    if (!result.outputText) {
      summaryParseFailures.push(buildEmptySummaryOutputFailure(attempt, result.finishReason));
    } else {
      try {
        parsedSummary = parseSummaryJsonObject(result.outputText);
        parsedSummaryOutputText = result.outputText;

        const validation = validateChapterSummaryOutput(parsedSummary);

        if (validation.ok) {
          summaryValidation = validation;
          break;
        }

        summarySchemaFailures.push(
          buildSummarySchemaValidationFailureLog(
            attempt,
            result.outputText,
            validation,
            attempt < CHAPTER_SUMMARY_GENERATION_ATTEMPTS ? attempt + 1 : null,
          ),
        );

        if (attempt < CHAPTER_SUMMARY_GENERATION_ATTEMPTS) {
          summaryPrompt = buildChapterSummaryRetryPrompt({
            originalPrompt: summaryUserPrompt,
            validationError: validation.error,
            missingFields: validation.missingFields,
            rawPreview: result.outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
          });
          continue;
        }
      } catch (error) {
        summaryParseFailures.push(
          buildSummaryJsonParseFailure(attempt, result.outputText, result.finishReason, error),
        );
      }
    }

    if (attempt === CHAPTER_SUMMARY_GENERATION_ATTEMPTS) {
      break;
    }
  }

  if (!summaryValidation?.ok) {
    const repair = repairChapterSummaryOutput(parsedSummary);

    if (repair.ok) {
      summaryValidation = { ok: true, summary: repair.summary };
      summaryRepairLog = {
        summaryRepaired: true,
        missingFields: repair.missingFields,
        repairedFields: repair.repairedFields,
        rawPreview: parsedSummaryOutputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
      };

      if (summarySchemaFailures.length > 0) {
        const lastFailure = summarySchemaFailures[summarySchemaFailures.length - 1];
        summarySchemaFailures[summarySchemaFailures.length - 1] = {
          ...lastFailure,
          repairedFields: repair.repairedFields,
          summaryRepaired: true,
        };
      }
    } else if (summarySchemaFailures.length > 0) {
      const lastFailure = summarySchemaFailures[summarySchemaFailures.length - 1];
      const error = `章节摘要 JSON 未通过 schema 校验：${lastFailure.validationError}`;
      summaryFallbackLog = {
        summaryFallback: true,
        reason: error,
        rawPreview: parsedSummaryOutputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
      };
      await writeSummaryErrorLog(
        error,
        summaryLogInput,
        chapterRow.id,
        {
          ...buildSummaryValidationLogOutput(
            summarySchemaFailures,
            summaryParseFailures,
            null,
            summaryFallbackLog,
          ),
          summaryRepairAttempt: {
            ok: false,
            error: repair.error,
            missingFields: repair.missingFields,
            repairedFields: repair.repairedFields,
            rawPreview: parsedSummaryOutputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
          },
        },
      );
      summaryValidation = {
        ok: true,
        summary: buildFallbackChapterSummaryPayload(chapter, outputText),
      };
    } else {
      const error = "DeepSeek 摘要生成失败：AI 输出不是有效 JSON。";
      const errorLog =
        summaryParseFailures.length > 0
          ? formatSummaryJsonFailureLog(summaryParseFailures)
          : error;
      summaryFallbackLog = {
        summaryFallback: true,
        reason: error,
        rawPreview: parsedSummaryOutputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
      };
      await writeSummaryErrorLog(
        errorLog,
        summaryLogInput,
        chapterRow.id,
        buildSummaryValidationLogOutput(
          summarySchemaFailures,
          summaryParseFailures,
          null,
          summaryFallbackLog,
        ),
      );
      summaryValidation = {
        ok: true,
        summary: buildFallbackChapterSummaryPayload(chapter, outputText),
      };
    }
  }

  const summary: ChapterSummary = buildChapterSummary(summaryValidation.summary, model);
  const autoDecisionResult = autoDecisionPromise ? await autoDecisionPromise : null;
  const autoDecisionSummary = buildDecisionGenerationSummary(autoDecisionResult);

  // 先记日志、再扣点、最后落库：扣点失败时不保存内容，保存失败时自动退点。
  const chapterLogInput = withQualityLogInput(logInput, qualityMode, qualityPipelineResult);
  const { data: generationLog, error: chapterLogError } = await supabase
    .from("generation_logs")
    .insert({
      project_id: visibleProject.id,
      operation: "generate_chapter",
      target_type: "chapter",
      target_id: chapterRow.id,
      model,
      prompt_version: CHAPTER_PROMPT_VERSION,
      input: chapterLogInput,
    })
    .select("id")
    .single<GenerationLogIdRow>();

  if (chapterLogError || !generationLog) {
    return serverError(
      `生成日志写入失败，本次未扣费：${chapterLogError?.message || "未知错误"}`,
    );
  }

  let creditBalanceAfter: number | null = null;

  // 精修步骤失败但已回退保留初稿时，按普通生成价格扣点。
  const rewriteFellBack =
    creditOperation === "generate_chapter_quality" &&
    qualityPipelineResult?.steps.rewrite === "failed";
  const effectiveCreditOperation = rewriteFellBack ? "generate_chapter" : creditOperation;

  if (!shouldDeferReadBilling) {
    const creditSpend = await spendGenerationCredits({
      supabase,
      projectId: visibleProject.id,
      generationLogId: generationLog.id,
      operation: effectiveCreditOperation,
      reason: rewriteFellBack
        ? "精修失败回退初稿，按普通生成计费"
        : qualityMode === "quality"
          ? "精修生成章节正文和摘要"
          : "生成章节正文和摘要",
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

    creditBalanceAfter = creditSpend.balanceAfter;
  }

  async function refundAndLogSaveFailure(saveError: string) {
    if (shouldDeferReadBilling) {
      await supabase
        .from("generation_logs")
        .update({ error: saveError })
        .eq("id", generationLog!.id);
      return "本次为后台缓存生成，未扣费。";
    }

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

  // 并发安全：版本号唯一冲突时重读最新版本号并重试。
  const VERSION_INSERT_ATTEMPTS = 3;
  let savedVersion: ChapterVersionIdRow | null = null;
  let versionErrorMessage = "";

  for (let attempt = 1; attempt <= VERSION_INSERT_ATTEMPTS; attempt += 1) {
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
      versionErrorMessage = `章节版本号读取失败：${latestVersionError.message}`;
      break;
    }

    const nextVersionNumber = (latestVersionRow?.version_number ?? 0) + 1;
    const { data: insertedVersion, error: versionError } = await supabase
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

    if (insertedVersion && !versionError) {
      savedVersion = insertedVersion;
      break;
    }

    versionErrorMessage = versionError?.message || "章节版本保存失败。";

    const isUniqueConflict =
      versionError?.code === "23505" || /duplicate key/i.test(versionErrorMessage);

    if (!isUniqueConflict || attempt === VERSION_INSERT_ATTEMPTS) {
      break;
    }
  }

  if (!savedVersion) {
    const saveError = versionErrorMessage || "章节版本保存失败。";
    const refundNote = await refundAndLogSaveFailure(saveError);
    return serverError(`章节版本保存失败，${refundNote}`);
  }

  const versionedDraft = {
    ...draft,
    versionId: savedVersion.id,
  };
  const baseChapterContent = buildChapterContent(
    chapter,
    versionedDraft,
    summary,
    chapterRow.content,
    savedVersion.version_number,
  );
  const routedBaseChapterContent = batchRouteMetadata
    ? baseChapterContent
    : withoutStaleRouteMetadata(baseChapterContent);
  const decisionChapterContent =
    projectMode === "interactive"
      ? withFreshInteractiveDecisionContent({
          baseContent: routedBaseChapterContent,
          decisionResult: autoDecisionResult,
        })
      : routedBaseChapterContent;
  const billableChapterContent = withoutReadBilling(decisionChapterContent);
  const chapterContent = batchRouteMetadata
    ? {
        ...billableChapterContent,
        routeMetadata: batchRouteMetadata,
      }
    : billableChapterContent;
  const preloadReadBilling = readerPreloadMetadata
    ? {
        state: "unclaimed" as const,
        source: "reader-preload-10" as const,
        cost: GENERATION_CREDIT_COSTS.claim_read_chapter,
        generationLogId: generationLog.id,
        anchorChapterNumber: readerPreloadMetadata.anchorChapterNumber,
        generatedAt: new Date().toISOString(),
      }
    : null;
  const finalChapterContent = preloadReadBilling
    ? {
        ...chapterContent,
        readBilling: preloadReadBilling,
      }
    : chapterContent;

  const { data: savedChapter, error: updateError } = await supabase
    .from("chapters")
    .update({ content: finalChapterContent })
    .eq("id", chapterRow.id)
    .eq("project_id", visibleProject.id)
    .eq("user_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (updateError || !savedChapter) {
    const saveError = updateError?.message || "章节正文保存失败。";
    await supabase
      .from("chapter_versions")
      .delete()
      .eq("id", savedVersion.id)
      .eq("user_id", user.id);
    const refundNote = await refundAndLogSaveFailure(saveError);
    return serverError(`章节正文保存失败，${refundNote}`);
  }

  const loggableChapterContent = shouldDeferReadBilling
    ? redactChapterBodies(finalChapterContent)
    : finalChapterContent;
  const chapterLogOutput = {
    chapter: loggableChapterContent,
    ...(autoDecisionSummary ? { autoDecision: autoDecisionSummary } : {}),
    ...(summaryFallbackLog ? { summaryFallback: summaryFallbackLog } : {}),
    ...(qualityMode === "quality" && qualityPipelineResult
      ? { quality: summarizeQualityPipelineResult(qualityPipelineResult) }
      : {}),
  };
  const { error: chapterLogUpdateError } = await supabase
    .from("generation_logs")
    .update({ output: chapterLogOutput })
    .eq("id", generationLog.id);

  if (chapterLogUpdateError) {
    return serverError(
      `章节正文和摘要已保存，但生成日志更新失败：${chapterLogUpdateError.message}`,
    );
  }

  if (autoDecisionResult) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_chapter_decision",
      target_type: "chapter",
      target_id: savedChapter.id,
      model,
      prompt_version: CHAPTER_DECISION_PROMPT_VERSION,
      input: {
        project: visibleProject,
        chapter,
        previousChapters: buildDecisionPreviousChapters(previousChapters),
        source: "auto-chapter-generation",
        currentChapterBodyPreview: outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
      },
      ...(autoDecisionResult.ok
        ? { output: { decision: autoDecisionResult.decision, source: "auto-chapter-generation" } }
        : {
            output: {
              decisionGeneration: buildDecisionGenerationSummary(autoDecisionResult),
              source: "auto-chapter-generation",
            },
            error: buildChapterDecisionGenerationLogError(autoDecisionResult),
          }),
    });
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
      ...buildSummaryValidationLogOutput(
        summarySchemaFailures,
        summaryParseFailures,
        summaryRepairLog,
        summaryFallbackLog,
      ),
    },
  });

  if (summaryLogError) {
    return serverError(`章节正文和摘要已保存，但摘要日志写入失败：${summaryLogError.message}`);
  }

  if (shouldDeferReadBilling) {
    // 后台缓存章节尚未付费解锁：响应中不返回正文，防止绕过 claim-read 计费。
    const redactedChapter = redactChapterBodies(finalChapterContent);

    return NextResponse.json({
      chapterId: savedChapter.id,
      chapter: redactedChapter,
      ...(autoDecisionSummary ? { autoDecision: autoDecisionSummary } : {}),
      credits: {
        cost: 0,
        deferredCost: GENERATION_CREDIT_COSTS.claim_read_chapter,
        balance: null,
      },
    });
  }

  return NextResponse.json({
    chapterId: savedChapter.id,
    chapter: finalChapterContent,
    ...(autoDecisionSummary ? { autoDecision: autoDecisionSummary } : {}),
    ...(qualityMode === "quality" && qualityPipelineResult
      ? { quality: summarizeQualityPipelineResult(qualityPipelineResult) }
      : {}),
    credits: {
      cost: GENERATION_CREDIT_COSTS[effectiveCreditOperation],
      balance: creditBalanceAfter,
    },
  });
}
