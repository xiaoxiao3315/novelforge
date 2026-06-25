// 章节生成的共享逻辑：数据准备、质量流水线、摘要、落库。
// 由 /api/generate/chapter（普通）与 /api/generate/chapter/stream（流式）共享。

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson, generateDeepSeekText, getDeepSeekModel } from "@/lib/ai/deepseek";
import { parseJsonObject } from "@/lib/ai/json";
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
  buildChapterDecisionGenerationMetadata,
  generateChapterDecision,
  summarizeChapterDecisionGenerationFailures,
  type ChapterDecisionGenerationResult,
} from "@/lib/interactive/chapter-decision-generation";
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
  DEFAULT_CHAPTER_WORD_TARGET,
  EMPTY_CHAPTER_INTERVENTION,
  normalizeChapterContent,
  type ChapterIntervention,
  type ChapterContent,
  type ChapterPromptInput,
} from "@/prompts/chapter";
import {
  normalizeChapterDecision,
  type ChapterDecisionPromptInput,
} from "@/prompts/chapter-decision";
import {
  buildChapterSummary,
  buildChapterSummaryPrompt,
  buildChapterSummaryRetryPrompt,
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

export type GenerateChapterBody = {
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

export type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
};

export type StoryConfigRow = {
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

export const CHAPTER_MAX_TOKENS = 6000;
export const CHAPTER_TEMPERATURE = 0.72;
export const CHAPTER_SUMMARY_GENERATION_ATTEMPTS = 2;
export const CHAPTER_QUALITY_JSON_GENERATION_ATTEMPTS = 2;
export const CHAPTER_SUMMARY_MAX_TOKENS = 1800;
export const CHAPTER_SUMMARY_TEMPERATURE = 0.1;
export const CHAPTER_FAST_GUIDANCE_MAX_TOKENS = 3400;
export const CHAPTER_FAST_GUIDANCE_TEMPERATURE = 0.1;
export const CHAPTER_QUALITY_PLAN_MAX_TOKENS = 2600;
export const CHAPTER_QUALITY_PLAN_TEMPERATURE = 0.1;
export const CHAPTER_QUALITY_CHARACTER_DIRECTION_MAX_TOKENS = 2500;
export const CHAPTER_QUALITY_CHARACTER_DIRECTION_TEMPERATURE = 0.1;
export const CHAPTER_QUALITY_CRITIQUE_MAX_TOKENS = 2600;
export const CHAPTER_QUALITY_CRITIQUE_TEMPERATURE = 0.1;
export const CHAPTER_QUALITY_REWRITE_MAX_TOKENS = 7000;
export const CHAPTER_QUALITY_REWRITE_TEMPERATURE = 0.68;
export const RAW_OUTPUT_PREVIEW_LENGTH = 1000;
export const CHAPTER_SYSTEM_PROMPT = [
  "你只输出中文小说正文。",
  "不要 Markdown，不要代码块，不要解释，不要大纲，不要标题分析。",
  "只写当前一章，不提前生成下一章，不生成整本小说。",
].join(" ");
export const CHAPTER_SUMMARY_SYSTEM_PROMPT = [
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
  "所有字符串字段必须是单行短句，不要在 JSON string 中输出裸换行、制表符或控制字符。",
  "只总结当前章节，不写正文，不续写，不生成整本小说。",
].join(" ");

export type ChapterSummaryPayload = Parameters<typeof buildChapterSummary>[0];

export type ChapterGenerationQualityMode = "normal" | "quality";

export type BatchChapterRouteMetadata = {
  generationSource: "batch-20";
  batchRunId?: string;
  routeMode: "default";
  routeRevision?: string;
  routeSnapshotHash?: string;
  qualityMode: "normal";
  isDefaultRoute: true;
};

export type ReaderPreloadMetadata = {
  generationSource: "reader-preload-10";
  anchorChapterNumber: number;
  qualityMode: "normal";
};

export type ChapterDraftQualityMetadata = {
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

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function cleanChapterBody(text: string) {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function normalizeQualityMode(
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

export function readOptionalMetadataString(
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

export function parseBatchRouteMetadata(
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

export function parseReaderPreloadMetadata(
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

export function isControlCharacterJsonError(error: unknown) {
  return /control character|bad control|unexpected token[\s\S]*(?:\n|\r|\t)/i.test(
    getErrorMessage(error),
  );
}

export function escapeControlCharactersInJsonStrings(text: string) {
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

export function parseSummaryJsonObject(text: string) {
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

export type QualityJsonValidationResult = { ok: true } | { ok: false; error: string };

export type QualityJsonValidator = (value: unknown) => QualityJsonValidationResult;

export function buildQualityJsonRetryPrompt({
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

export async function generateQualityJsonWithRetry({
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

export function buildFallbackChapterSummaryPayload(
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readInterventionField(
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

export function parseChapterIntervention(value: unknown) {
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

export function buildPromptInput(
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

export function formatDecisionSummaryText(chapter: ReturnType<typeof buildPreviousChapterContext>) {
  if (chapter.summary) {
    return [
      ...chapter.summary.keyEvents,
      ...chapter.summary.characterStateChanges,
      ...chapter.summary.unresolvedQuestions,
    ].join("；");
  }

  return chapter.draftExcerpt;
}

export function buildDecisionPreviousChapters(
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[],
): ChapterDecisionPromptInput["previousChapters"] {
  return previousChapters.map((chapter) => ({
    ...chapter,
    summaryText: formatDecisionSummaryText(chapter),
  }));
}

export function buildDecisionPromptInput({
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

export function buildDecisionGenerationSummary(result: ChapterDecisionGenerationResult | null) {
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

export function withFreshInteractiveDecisionContent({
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

export function withoutStaleRouteMetadata(content: ChapterContent): ChapterContent {
  const nextContent = { ...content };

  delete nextContent.routeMetadata;
  delete nextContent.needsRegeneration;
  delete nextContent.stale;

  return nextContent;
}

export function withoutReadBilling(content: ChapterContent): ChapterContent {
  const nextContent = { ...content };

  delete nextContent.readBilling;

  return nextContent;
}

export function hasUnlockedReadableBody(content: unknown) {
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
export const QUALITY_CONTEXT_EXCERPT_WINDOW = 8;
export const QUALITY_CONTEXT_SUMMARY_WINDOW = 24;

export function buildQualityPreviousSummaries(
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

export function buildChapterQualityContext(input: ChapterPromptInput): ChapterQualityPromptContext {
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

export function createQualityPipelineModel(promptInput: ChapterPromptInput): QualityPipelineModel {
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

export function buildQualityPromptVersions(pipelineResult: ChapterQualityPipelineResult) {
  return pipelineResult.metadata.promptVersions;
}

export function buildQualityMetadata(
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

export function summarizeChapterPlan(plan: ChapterWritingPlan | undefined) {
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

export function summarizeChapterCharacterDirection(
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

export function summarizeQualityPipelineResult(pipelineResult: ChapterQualityPipelineResult) {
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

export async function buildInternalChapterSummary({
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

export type PreparedChapterGeneration = {
  batchRouteMetadata: BatchChapterRouteMetadata | null;
  readerPreloadMetadata: ReaderPreloadMetadata | null;
  qualityMode: ChapterGenerationQualityMode;
  intervention: ChapterIntervention;
  projectId: string;
  visibleProject: ProjectRow;
  config: StoryConfigRow;
  model: string;
  concept: StoryConcept;
  bible: StoryBible;
  characters: CharacterCard[];
  chapterRow: NonNullable<Awaited<ReturnType<typeof getInternalProjectBundle>>>["chapters"][number];
  chapter: ChapterOutline;
  volume: VolumeOutline;
  previousChapters: ReturnType<typeof buildPreviousChapterContext>[];
  projectMode: ReturnType<typeof getProjectModeFromConfig>;
  promptInput: ChapterPromptInput;
};

// 数据准备：校验 body、读 bundle、normalize 各部分、组装 promptInput。
// 普通端点与流式端点共享此逻辑，避免重复。
// 返回 { ok:false, response } 时直接把 response 返回给客户端；
// 返回 { ok:true, ... , earlyResponse } 时 earlyResponse 非空表示命中预加载幂等短路。
export async function prepareChapterGeneration(
  body: GenerateChapterBody,
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; data: PreparedChapterGeneration; earlyResponse: NextResponse | null }
> {
  const batchRouteMetadataValidation = parseBatchRouteMetadata(body);

  if (!batchRouteMetadataValidation.ok) {
    return { ok: false, response: validationError(batchRouteMetadataValidation.error) };
  }

  const batchRouteMetadata = batchRouteMetadataValidation.metadata;
  const readerPreloadMetadataValidation = parseReaderPreloadMetadata(body);

  if (!readerPreloadMetadataValidation.ok) {
    return { ok: false, response: validationError(readerPreloadMetadataValidation.error) };
  }

  const readerPreloadMetadata = readerPreloadMetadataValidation.metadata;
  const qualityModeValidation = normalizeQualityMode(body.qualityMode);

  if (!qualityModeValidation.ok) {
    return { ok: false, response: validationError(qualityModeValidation.error) };
  }

  const { qualityMode } = qualityModeValidation;
  const interventionValidation = parseChapterIntervention(body.intervention);

  if (!interventionValidation.ok) {
    return { ok: false, response: validationError(interventionValidation.error) };
  }

  const { intervention } = interventionValidation;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isInteger(body.chapterNumber)
      ? body.chapterNumber
      : null;

  if (!projectId) {
    return { ok: false, response: validationError("Missing project.") };
  }

  if (!chapterId && !chapterNumber) {
    return { ok: false, response: validationError("Missing chapter outline.") };
  }

  const bundle = await getInternalProjectBundle(projectId);

  if (!bundle || !bundle.config) {
    return { ok: false, response: validationError("Missing project.") };
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
    return { ok: false, response: validationError("Missing story_concept.") };
  }

  const bible = normalizeStoryBible(bundle.bible);

  if (!bible) {
    return { ok: false, response: validationError("Missing story_bible.") };
  }

  const characters = normalizeCharacterCards(bundle.characters);

  if (characters.length === 0) {
    return { ok: false, response: validationError("Missing characters.") };
  }

  const chapterRow =
    (chapterId ? bundle.chapters.find((row) => row.id === chapterId) : null) ??
    (chapterNumber
      ? bundle.chapters.find((row) => row.chapter_number === chapterNumber)
      : null);
  const chapter = chapterRow ? normalizeChapterOutlines([chapterRow.content])[0] ?? null : null;

  if (!chapterRow || !chapter) {
    return { ok: false, response: validationError("Missing chapter outline.") };
  }

  if (!chapterRow.volume_id) {
    return { ok: false, response: validationError("Missing chapter volume.") };
  }

  const volumeRow = bundle.volumes.find((row) => row.id === chapterRow.volume_id);
  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    return { ok: false, response: validationError("Missing volume.") };
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

  let earlyResponse: NextResponse | null = null;

  if (readerPreloadMetadata) {
    if (projectMode !== "interactive") {
      return {
        ok: false,
        response: validationError("reader-preload-10 only supports interactive projects."),
      };
    }

    const { anchorChapterNumber } = readerPreloadMetadata;

    if (
      chapter.chapterNumber <= anchorChapterNumber ||
      chapter.chapterNumber > anchorChapterNumber + 10
    ) {
      return {
        ok: false,
        response: validationError(
          "reader-preload-10 can only generate the next 10 chapters from the anchor.",
        ),
      };
    }

    const anchorChapterRow = previousRows.find(
      (row) => row.chapter_number === anchorChapterNumber,
    );

    if (!anchorChapterRow || !hasUnlockedReadableBody(anchorChapterRow.content)) {
      return {
        ok: false,
        response: validationError(
          "reader-preload-10 requires a readable unlocked anchor chapter.",
        ),
      };
    }

    const existingPreloadContent = normalizeChapterContent(chapterRow.content);

    if (
      existingPreloadContent &&
      !existingPreloadContent.needsRegeneration &&
      !existingPreloadContent.stale &&
      (existingPreloadContent.official?.body || existingPreloadContent.draft?.body)
    ) {
      earlyResponse = NextResponse.json({
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

  return {
    ok: true,
    earlyResponse,
    data: {
      batchRouteMetadata,
      readerPreloadMetadata,
      qualityMode,
      intervention,
      projectId,
      visibleProject,
      config,
      model,
      concept,
      bible,
      characters,
      chapterRow,
      chapter,
      volume,
      previousChapters,
      projectMode,
      promptInput,
    },
  };
}

// 落库：生成摘要 + 自动分歧 + 组装 ChapterContent + 保存。
// 普通端点与流式端点共享。outputText 由各端点先行生成（串行或流式）。
export async function finalizeChapterGeneration(
  prepared: PreparedChapterGeneration,
  outputText: string,
  qualityMetadata: ChapterDraftQualityMetadata | null,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      chapterId: string;
      chapterContent: ChapterContent;
      autoDecisionSummary: ReturnType<typeof buildDecisionGenerationSummary>;
    }
> {
  const {
    batchRouteMetadata,
    intervention,
    projectId,
    visibleProject,
    config,
    model,
    concept,
    bible,
    characters,
    chapterRow,
    chapter,
    volume,
    previousChapters,
    projectMode,
    promptInput,
  } = prepared;

  const existingContent = normalizeChapterContent(chapterRow.content);
  const nextVersionCount = (existingContent?.versionCount ?? 0) + 1;
  const baseDraft = buildChapterDraft(outputText, model, promptInput.wordTarget, intervention);
  const draft = {
    ...baseDraft,
    versionId: `internal-${nextVersionCount}-${randomUUID()}`,
    ...(qualityMetadata ? { quality: qualityMetadata } : {}),
    ...(batchRouteMetadata ? { routeMetadata: batchRouteMetadata } : {}),
  };
  const shouldGenerateAutoDecision =
    process.env.ENABLE_AUTO_CHAPTER_DECISION === "true" && projectMode === "interactive";
  const autoDecisionPromise = shouldGenerateAutoDecision
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
    return { ok: false, response: serverError("Chapter body save failed.") };
  }

  return {
    ok: true,
    chapterId: savedChapter.id,
    chapterContent,
    autoDecisionSummary,
  };
}

export async function generateInternalChapter(body: GenerateChapterBody) {
  const prepared = await prepareChapterGeneration(body);

  if (!prepared.ok) {
    return prepared.response;
  }

  if (prepared.earlyResponse) {
    return prepared.earlyResponse;
  }

  const { qualityMode, promptInput } = prepared.data;
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

  const finalized = await finalizeChapterGeneration(prepared.data, outputText, qualityMetadata);

  if (!finalized.ok) {
    return finalized.response;
  }

  return NextResponse.json({
    chapterId: finalized.chapterId,
    chapter: finalized.chapterContent,
    ...(finalized.autoDecisionSummary ? { autoDecision: finalized.autoDecisionSummary } : {}),
    ...(qualityMode === "quality" && qualityPipelineResult
      ? { quality: summarizeQualityPipelineResult(qualityPipelineResult) }
      : {}),
    credits: {
      cost: 0,
      balance: 9999,
    },
  });
}

