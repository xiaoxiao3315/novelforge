import {
  CHAPTER_QUALITY_SCORE_KEYS,
  type ChapterQualityCritique,
  type ChapterQualityScoreKey,
  type ChapterQualityScores,
} from "@/lib/quality/types";

export const CHAPTER_QUALITY_SCORE_MIN = 0;
export const CHAPTER_QUALITY_SCORE_MAX = 100;

const critiqueArrayFields = [
  "strengths",
  "weaknesses",
  "revisionDirectives",
  "continuityRisks",
  "mustKeep",
  "mustFix",
] as const;

type CritiqueArrayField = (typeof critiqueArrayFields)[number];

type ValidationResult =
  | { ok: true; critique: ChapterQualityCritique }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string, maxLength = 500) {
  return value.trim().slice(0, maxLength);
}

export function clampQualityScore(value: number) {
  if (!Number.isFinite(value)) {
    return CHAPTER_QUALITY_SCORE_MIN;
  }

  return Math.max(
    CHAPTER_QUALITY_SCORE_MIN,
    Math.min(CHAPTER_QUALITY_SCORE_MAX, Math.round(value)),
  );
}

function readScore(source: Record<string, unknown>, key: ChapterQualityScoreKey) {
  const value = source[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false as const, error: `scores.${key} 必须是数字。` };
  }

  return { ok: true as const, score: clampQualityScore(value) };
}

function readScores(value: unknown) {
  if (!isRecord(value)) {
    return { ok: false as const, error: "scores 必须是 JSON object。" };
  }

  const scores = {} as ChapterQualityScores;

  for (const key of CHAPTER_QUALITY_SCORE_KEYS) {
    if (!(key in value)) {
      return { ok: false as const, error: `scores 缺少字段：${key}。` };
    }

    const result = readScore(value, key);

    if (!result.ok) {
      return result;
    }

    scores[key] = result.score;
  }

  return { ok: true as const, scores };
}

function readStringArray(source: Record<string, unknown>, key: CritiqueArrayField) {
  const value = source[key];

  if (!Array.isArray(value)) {
    return { ok: false as const, error: `${key} 必须是字符串数组。` };
  }

  const items: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false as const, error: `${key} 只能包含字符串。` };
    }

    const text = cleanText(item);

    if (text) {
      items.push(text);
    }
  }

  return { ok: true as const, items: items.slice(0, 12) };
}

export function validateChapterQualityCritique(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "critique 必须是 JSON object。" };
  }

  if (!("scores" in value)) {
    return { ok: false, error: "critique 缺少字段：scores。" };
  }

  if (!("overallScore" in value)) {
    return { ok: false, error: "critique 缺少字段：overallScore。" };
  }

  const scoresResult = readScores(value.scores);

  if (!scoresResult.ok) {
    return { ok: false, error: scoresResult.error };
  }

  if (typeof value.overallScore !== "number" || !Number.isFinite(value.overallScore)) {
    return { ok: false, error: "overallScore 必须是数字。" };
  }

  const arrays = {} as Record<CritiqueArrayField, string[]>;

  for (const key of critiqueArrayFields) {
    if (!(key in value)) {
      return { ok: false, error: `critique 缺少字段：${key}。` };
    }

    const result = readStringArray(value, key);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    arrays[key] = result.items;
  }

  return {
    ok: true,
    critique: {
      scores: scoresResult.scores,
      overallScore: clampQualityScore(value.overallScore),
      strengths: arrays.strengths,
      weaknesses: arrays.weaknesses,
      revisionDirectives: arrays.revisionDirectives,
      continuityRisks: arrays.continuityRisks,
      mustKeep: arrays.mustKeep,
      mustFix: arrays.mustFix,
    },
  };
}

export function normalizeChapterQualityCritique(value: unknown) {
  const result = validateChapterQualityCritique(value);
  return result.ok ? result.critique : null;
}

export function isChapterQualityCritique(value: unknown): value is ChapterQualityCritique {
  return validateChapterQualityCritique(value).ok;
}
