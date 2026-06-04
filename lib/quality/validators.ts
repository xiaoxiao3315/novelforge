import {
  CHAPTER_QUALITY_SCORE_KEYS,
  type ChapterCharacterDirection,
  type ChapterQualityCritique,
  type ChapterQualityScoreKey,
  type ChapterQualityScores,
  type ChapterWritingPlan,
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

const chapterPlanStringFields = [
  "chapterGoal",
  "coreConflict",
  "emotionalArc",
  "endingHook",
] as const;

const chapterPlanArrayFields = [
  "keyScenes",
  "suspenseAndHooks",
  "mustInclude",
  "mustAvoid",
  "pacingPlan",
  "continuityNotes",
] as const;

const chapterPlanBeatFields = [
  "character",
  "goal",
  "emotionalChange",
  "dialogueTone",
] as const;

const chapterCharacterDirectionArrayFields = [
  "relationshipBeats",
  "dialogueRules",
  "actionRules",
  "hiddenInformation",
  "continuityGuards",
  "mustInclude",
  "mustAvoid",
] as const;

const chapterCharacterFocusStringFields = [
  "character",
  "activeDesire",
  "emotionalMask",
  "dialogueVoice",
  "actionPattern",
  "relationshipPressure",
] as const;

const chapterCharacterDirectionWrapperFields = [
  "characterDirection",
  "chapterCharacterDirection",
  "direction",
] as const;

type ChapterPlanStringField = (typeof chapterPlanStringFields)[number];
type ChapterPlanArrayField = (typeof chapterPlanArrayFields)[number];
type ChapterPlanBeatField = (typeof chapterPlanBeatFields)[number];
type ChapterCharacterDirectionArrayField =
  (typeof chapterCharacterDirectionArrayFields)[number];
type ChapterCharacterFocusStringField =
  (typeof chapterCharacterFocusStringFields)[number];

type ValidationResult =
  | { ok: true; critique: ChapterQualityCritique }
  | { ok: false; error: string };

type ChapterPlanValidationResult =
  | { ok: true; plan: ChapterWritingPlan }
  | { ok: false; error: string };

type ChapterCharacterDirectionValidationResult =
  | { ok: true; direction: ChapterCharacterDirection }
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

function readStringArray(source: Record<string, unknown>, key: string, maxItems = 12) {
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

  return { ok: true as const, items: items.slice(0, maxItems) };
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

function readRequiredStringField(
  source: Record<string, unknown>,
  key: string,
  scope: string,
  maxLength = 500,
) {
  if (!(key in source)) {
    return { ok: false as const, error: `${scope} missing field: ${key}.` };
  }

  const value = source[key];

  if (typeof value !== "string") {
    return { ok: false as const, error: `${scope}.${key} must be a string.` };
  }

  return { ok: true as const, text: cleanText(value, maxLength) };
}

function readFocusCharacters(source: Record<string, unknown>) {
  const value = source.focusCharacters;

  if (!Array.isArray(value)) {
    return {
      ok: false as const,
      error: "focusCharacters must be an object array.",
    };
  }

  const focusCharacters: ChapterCharacterDirection["focusCharacters"] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return {
        ok: false as const,
        error: "focusCharacters can only contain objects.",
      };
    }

    const character = {} as Record<ChapterCharacterFocusStringField, string>;

    for (const key of chapterCharacterFocusStringFields) {
      const result = readRequiredStringField(item, key, "focusCharacters");

      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }

      character[key] = result.text;
    }

    if (!("mustNotDo" in item)) {
      return {
        ok: false as const,
        error: "focusCharacters missing field: mustNotDo.",
      };
    }

    const mustNotDoResult = readStringArray(item, "mustNotDo", 12);

    if (!mustNotDoResult.ok) {
      return { ok: false as const, error: mustNotDoResult.error };
    }

    focusCharacters.push({
      character: character.character,
      activeDesire: character.activeDesire,
      emotionalMask: character.emotionalMask,
      dialogueVoice: character.dialogueVoice,
      actionPattern: character.actionPattern,
      relationshipPressure: character.relationshipPressure,
      mustNotDo: mustNotDoResult.items,
    });
  }

  return {
    ok: true as const,
    focusCharacters: focusCharacters.slice(0, 12),
  };
}

function unwrapChapterCharacterDirection(value: unknown) {
  if (!isRecord(value) || "povGuidance" in value) {
    return value;
  }

  for (const key of chapterCharacterDirectionWrapperFields) {
    const wrappedValue = value[key];

    if (isRecord(wrappedValue)) {
      return wrappedValue;
    }
  }

  return value;
}

export function validateChapterCharacterDirection(
  value: unknown,
): ChapterCharacterDirectionValidationResult {
  const directionValue = unwrapChapterCharacterDirection(value);

  if (!isRecord(directionValue)) {
    return { ok: false, error: "chapter character direction must be a JSON object." };
  }

  const povGuidanceResult = readRequiredStringField(
    directionValue,
    "povGuidance",
    "chapter character direction",
    800,
  );

  if (!povGuidanceResult.ok) {
    return { ok: false, error: povGuidanceResult.error };
  }

  if (!("focusCharacters" in directionValue)) {
    return {
      ok: false,
      error: "chapter character direction missing field: focusCharacters.",
    };
  }

  const focusCharactersResult = readFocusCharacters(directionValue);

  if (!focusCharactersResult.ok) {
    return { ok: false, error: focusCharactersResult.error };
  }

  const arrays = {} as Record<ChapterCharacterDirectionArrayField, string[]>;

  for (const key of chapterCharacterDirectionArrayFields) {
    if (!(key in directionValue)) {
      return {
        ok: false,
        error: `chapter character direction missing field: ${key}.`,
      };
    }

    const result = readStringArray(directionValue, key, 16);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    arrays[key] = result.items;
  }

  return {
    ok: true,
    direction: {
      povGuidance: povGuidanceResult.text,
      focusCharacters: focusCharactersResult.focusCharacters,
      relationshipBeats: arrays.relationshipBeats,
      dialogueRules: arrays.dialogueRules,
      actionRules: arrays.actionRules,
      hiddenInformation: arrays.hiddenInformation,
      continuityGuards: arrays.continuityGuards,
      mustInclude: arrays.mustInclude,
      mustAvoid: arrays.mustAvoid,
    },
  };
}

export function normalizeChapterCharacterDirection(value: unknown) {
  const result = validateChapterCharacterDirection(value);
  return result.ok ? result.direction : null;
}

export function isChapterCharacterDirection(value: unknown): value is ChapterCharacterDirection {
  return validateChapterCharacterDirection(value).ok;
}

function readRequiredPlanString(source: Record<string, unknown>, key: ChapterPlanStringField) {
  const value = source[key];

  if (typeof value !== "string") {
    return { ok: false as const, error: `${key} must be a string.` };
  }

  const text = cleanText(value, 800);

  if (!text) {
    return { ok: false as const, error: `${key} cannot be empty.` };
  }

  return { ok: true as const, text };
}

function readCharacterBeats(source: Record<string, unknown>) {
  const value = source.characterBeats;

  if (!Array.isArray(value)) {
    return { ok: false as const, error: "characterBeats must be an object array." };
  }

  const beats: ChapterWritingPlan["characterBeats"] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return { ok: false as const, error: "characterBeats can only contain objects." };
    }

    const beat = {} as Record<ChapterPlanBeatField, string>;

    for (const key of chapterPlanBeatFields) {
      const fieldValue = item[key];

      if (typeof fieldValue !== "string") {
        return { ok: false as const, error: `characterBeats.${key} must be a string.` };
      }

      beat[key] = cleanText(fieldValue, 500);
    }

    if (Object.values(beat).some(Boolean)) {
      beats.push({
        character: beat.character,
        goal: beat.goal,
        emotionalChange: beat.emotionalChange,
        dialogueTone: beat.dialogueTone,
      });
    }
  }

  return { ok: true as const, beats: beats.slice(0, 12) };
}

export function validateChapterWritingPlan(value: unknown): ChapterPlanValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "chapter plan must be a JSON object." };
  }

  const strings = {} as Record<ChapterPlanStringField, string>;

  for (const key of chapterPlanStringFields) {
    if (!(key in value)) {
      return { ok: false, error: `chapter plan missing field: ${key}.` };
    }

    const result = readRequiredPlanString(value, key);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    strings[key] = result.text;
  }

  const arrays = {} as Record<ChapterPlanArrayField, string[]>;

  for (const key of chapterPlanArrayFields) {
    if (!(key in value)) {
      return { ok: false, error: `chapter plan missing field: ${key}.` };
    }

    const result = readStringArray(value, key, 16);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    arrays[key] = result.items;
  }

  if (!("characterBeats" in value)) {
    return { ok: false, error: "chapter plan missing field: characterBeats." };
  }

  const beats = readCharacterBeats(value);

  if (!beats.ok) {
    return { ok: false, error: beats.error };
  }

  return {
    ok: true,
    plan: {
      chapterGoal: strings.chapterGoal,
      coreConflict: strings.coreConflict,
      emotionalArc: strings.emotionalArc,
      keyScenes: arrays.keyScenes,
      characterBeats: beats.beats,
      suspenseAndHooks: arrays.suspenseAndHooks,
      mustInclude: arrays.mustInclude,
      mustAvoid: arrays.mustAvoid,
      pacingPlan: arrays.pacingPlan,
      endingHook: strings.endingHook,
      continuityNotes: arrays.continuityNotes,
    },
  };
}

export function normalizeChapterWritingPlan(value: unknown) {
  const result = validateChapterWritingPlan(value);
  return result.ok ? result.plan : null;
}

export function isChapterWritingPlan(value: unknown): value is ChapterWritingPlan {
  return validateChapterWritingPlan(value).ok;
}
