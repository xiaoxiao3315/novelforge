import type { CharacterCard, StoryBible } from "@/prompts/bible";
import type { StoryConcept } from "@/prompts/concept";

export const OUTLINE_PROMPT_VERSION = "outline-v2";
export const DEFAULT_OUTLINE_CHAPTER_COUNT = 20;
export const DEFAULT_ESTIMATED_WORDS = 2500;

export type VolumeOutline = {
  volumeNumber: number;
  title: string;
  summary: string;
  mainConflict: string;
  endingHook: string;
};

export type ChapterOutline = {
  chapterNumber: number;
  title: string;
  event: string;
  conflict: string;
  characterChange: string;
  highlight: string;
  foreshadowing: string;
  endingHook: string;
  estimatedWords: number;
};

export type OutlineGeneration = {
  volume: VolumeOutline;
  chapters: ChapterOutline[];
};

export type OutlinePromptInput = {
  project: {
    title: string;
    description: string | null;
  };
  config: {
    theme: string;
    genre: string;
    background: string;
    worldSetting: string;
    protagonist: string;
    coreConflict: string;
    tone: string;
    serialStructure: string;
    extraIdeas: string | null;
  };
  concept: StoryConcept;
  bible: StoryBible;
  characters: CharacterCard[];
};

const volumeTextFields = ["title", "summary", "mainConflict", "endingHook"] as const;
const volumeSchemaKeys = ["volumeNumber", ...volumeTextFields] as const;
const volumeSchemaKeySet = new Set<string>(volumeSchemaKeys);

const chapterTextFields = [
  "title",
  "event",
  "conflict",
  "characterChange",
  "highlight",
  "foreshadowing",
  "endingHook",
] as const;
const chapterSchemaKeys = ["chapterNumber", ...chapterTextFields, "estimatedWords"] as const;
const chapterSchemaKeySet = new Set<string>(chapterSchemaKeys);

const outlineJsonStructureExample = JSON.stringify(
  {
    volume: {
      volumeNumber: 1,
      title: "第一卷卷名",
      summary: "第一卷摘要，说明开局处境、阶段目标、关键转折和卷末爆点。",
      mainConflict: "第一卷主线冲突，必须贯穿 20 章并逐步升级。",
      endingHook: "第一卷结尾钩子，为第二卷或后续正文留下强追读悬念。",
    },
    chapters: [
      {
        chapterNumber: 1,
        title: "章节标题",
        event: "本章发生的核心事件，不写正文，只写大纲。",
        conflict: "本章主要冲突，说明阻力和代价。",
        characterChange: "本章角色关系、心态或能力变化。",
        highlight: "本章爽点 / 看点。",
        foreshadowing: "本章埋下或回收的伏笔。",
        endingHook: "本章结尾钩子。",
        estimatedWords: 2500,
      },
    ],
  },
  null,
  2,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 1400) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  scope: string,
) {
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (extraKeys.length > 0) {
    return `${scope} 包含 schema 外字段：${extraKeys.join(", ")}。`;
  }

  return "";
}

function validateTextField(
  value: Record<string, unknown>,
  field: string,
  scope: string,
  maxLength: number,
) {
  const rawValue = value[field];

  if (typeof rawValue !== "string") {
    return `${scope}.${field} 必须是字符串。`;
  }

  const cleaned = rawValue.trim();

  if (!cleaned) {
    return `${scope}.${field} 不能为空。`;
  }

  if (cleaned.length > maxLength) {
    return `${scope}.${field} 超过 ${maxLength} 字符。`;
  }

  return "";
}

function normalizePositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export function normalizeVolumeOutline(value: unknown): VolumeOutline | null {
  if (!isRecord(value)) {
    return null;
  }

  const volumeNumber = normalizePositiveInteger(value.volumeNumber);

  if (!volumeNumber) {
    return null;
  }

  const volume = {} as Record<(typeof volumeTextFields)[number], string>;

  for (const field of volumeTextFields) {
    const maxLength = field === "title" ? 160 : 1600;
    const cleaned = cleanText(value[field], maxLength);

    if (!cleaned) {
      return null;
    }

    volume[field] = cleaned;
  }

  return {
    volumeNumber,
    title: volume.title,
    summary: volume.summary,
    mainConflict: volume.mainConflict,
    endingHook: volume.endingHook,
  };
}

export function normalizeChapterOutlines(value: unknown): ChapterOutline[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const chapterNumber = normalizePositiveInteger(item.chapterNumber);
      const estimatedWords = normalizePositiveInteger(item.estimatedWords);

      if (!chapterNumber || !estimatedWords) {
        return null;
      }

      const chapter = {} as Record<(typeof chapterTextFields)[number], string>;

      for (const field of chapterTextFields) {
        const maxLength = field === "title" ? 160 : 1400;
        const cleaned = cleanText(item[field], maxLength);

        if (!cleaned) {
          return null;
        }

        chapter[field] = cleaned;
      }

      return {
        chapterNumber,
        title: chapter.title,
        event: chapter.event,
        conflict: chapter.conflict,
        characterChange: chapter.characterChange,
        highlight: chapter.highlight,
        foreshadowing: chapter.foreshadowing,
        endingHook: chapter.endingHook,
        estimatedWords,
      };
    })
    .filter((item): item is ChapterOutline => Boolean(item))
    .sort((left, right) => left.chapterNumber - right.chapterNumber);
}

export function validateOutlineGenerationSchema(
  value: unknown,
):
  | { ok: true; volume: VolumeOutline; chapters: ChapterOutline[] }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "输出必须是 JSON object。" };
  }

  const topLevelError = validateExactKeys(value, new Set(["volume", "chapters"]), "根对象");

  if (topLevelError) {
    return { ok: false, error: topLevelError };
  }

  const volumeValue = value.volume;

  if (!isRecord(volumeValue)) {
    return { ok: false, error: "volume 必须是 JSON object。" };
  }

  const volumeExtraKeyError = validateExactKeys(volumeValue, volumeSchemaKeySet, "volume");

  if (volumeExtraKeyError) {
    return { ok: false, error: volumeExtraKeyError };
  }

  const missingVolumeKeys = volumeSchemaKeys.filter((key) => !(key in volumeValue));

  if (missingVolumeKeys.length > 0) {
    return { ok: false, error: `volume 缺少字段：${missingVolumeKeys.join(", ")}。` };
  }

  if (volumeValue.volumeNumber !== 1) {
    return { ok: false, error: "volume.volumeNumber 必须是 1。" };
  }

  for (const field of volumeTextFields) {
    const maxLength = field === "title" ? 160 : 1600;
    const fieldError = validateTextField(volumeValue, field, "volume", maxLength);

    if (fieldError) {
      return { ok: false, error: fieldError };
    }
  }

  const volume = normalizeVolumeOutline(volumeValue);

  if (!volume) {
    return { ok: false, error: "volume 未通过本地规范化。" };
  }

  if (!Array.isArray(value.chapters)) {
    return { ok: false, error: "chapters 必须是数组。" };
  }

  if (value.chapters.length !== DEFAULT_OUTLINE_CHAPTER_COUNT) {
    return {
      ok: false,
      error: `chapters 必须包含 ${DEFAULT_OUTLINE_CHAPTER_COUNT} 章。`,
    };
  }

  const chapterNumbers = new Set<number>();
  const chapters: ChapterOutline[] = [];

  for (const [index, item] of value.chapters.entries()) {
    if (!isRecord(item)) {
      return { ok: false, error: `chapters[${index}] 必须是 JSON object。` };
    }

    const chapterExtraKeyError = validateExactKeys(
      item,
      chapterSchemaKeySet,
      `chapters[${index}]`,
    );

    if (chapterExtraKeyError) {
      return { ok: false, error: chapterExtraKeyError };
    }

    const missingChapterKeys = chapterSchemaKeys.filter((key) => !(key in item));

    if (missingChapterKeys.length > 0) {
      return {
        ok: false,
        error: `chapters[${index}] 缺少字段：${missingChapterKeys.join(", ")}。`,
      };
    }

    const chapterNumber = item.chapterNumber;

    if (typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber)) {
      return { ok: false, error: `chapters[${index}].chapterNumber 必须是整数。` };
    }

    if (chapterNumber < 1 || chapterNumber > DEFAULT_OUTLINE_CHAPTER_COUNT) {
      return {
        ok: false,
        error: `chapters[${index}].chapterNumber 必须在 1 到 ${DEFAULT_OUTLINE_CHAPTER_COUNT} 之间。`,
      };
    }

    if (chapterNumbers.has(chapterNumber)) {
      return { ok: false, error: `chapters 包含重复章节编号：${chapterNumber}。` };
    }

    chapterNumbers.add(chapterNumber);

    const chapter = {} as Record<(typeof chapterTextFields)[number], string>;

    for (const field of chapterTextFields) {
      const maxLength = field === "title" ? 160 : 1400;
      const fieldError = validateTextField(item, field, `chapters[${index}]`, maxLength);

      if (fieldError) {
        return { ok: false, error: fieldError };
      }

      chapter[field] = (item[field] as string).trim();
    }

    const estimatedWords = item.estimatedWords;

    if (typeof estimatedWords !== "number" || !Number.isInteger(estimatedWords)) {
      return { ok: false, error: `chapters[${index}].estimatedWords 必须是整数。` };
    }

    if (estimatedWords < 1500 || estimatedWords > 3500) {
      return {
        ok: false,
        error: `chapters[${index}].estimatedWords 必须在 1500 到 3500 之间。`,
      };
    }

    chapters.push({
      chapterNumber,
      title: chapter.title,
      event: chapter.event,
      conflict: chapter.conflict,
      characterChange: chapter.characterChange,
      highlight: chapter.highlight,
      foreshadowing: chapter.foreshadowing,
      endingHook: chapter.endingHook,
      estimatedWords,
    });
  }

  for (let chapterNumber = 1; chapterNumber <= DEFAULT_OUTLINE_CHAPTER_COUNT; chapterNumber += 1) {
    if (!chapterNumbers.has(chapterNumber)) {
      return { ok: false, error: `chapters 缺少第 ${chapterNumber} 章。` };
    }
  }

  return {
    ok: true,
    volume,
    chapters: chapters.sort((left, right) => left.chapterNumber - right.chapterNumber),
  };
}

export function buildOutlinePrompt(input: OutlinePromptInput) {
  return [
    "你是严谨的长篇网文第一卷章节大纲策划。请基于已保存的 story_config、story_concept、story_bible 和 characters 生成第一卷章节大纲。",
    "",
    "硬性要求：",
    "- 只生成第一卷章节大纲，不生成任何章节正文。",
    `- 必须生成 ${DEFAULT_OUTLINE_CHAPTER_COUNT} 章，每章 estimatedWords 默认围绕 ${DEFAULT_ESTIMATED_WORDS} 字。`,
    "- 只能输出一个 JSON object，首字符必须是 {，末字符必须是 }。",
    "- 不要 Markdown，不要代码块，不要解释，不要前言或结语，不要在 JSON 前后输出任何多余文本。",
    "- 必须严格符合下方目标 JSON 结构示例：顶层只能有 volume 和 chapters，字段名、层级和类型必须一致，不得添加 schema 外字段。",
    "- 不得生成 TipTap、改写、续写、收费、社区或排行榜相关内容。",
    "- 每章必须服务第一卷主线冲突，并保留足够的结尾钩子供后续单章正文生成使用。",
    "",
    "已保存 story_config：",
    `- 作品名：${input.project.title}`,
    `- 一句话简介：${input.project.description || "未填写"}`,
    `- 主题：${input.config.theme}`,
    `- 类型：${input.config.genre}`,
    `- 背景：${input.config.background}`,
    `- 世界设定：${input.config.worldSetting}`,
    `- 主角方向：${input.config.protagonist}`,
    `- 核心冲突：${input.config.coreConflict}`,
    `- 基调：${input.config.tone}`,
    `- 连载结构：${input.config.serialStructure}`,
    `- 补充想法：${input.config.extraIdeas || "未填写"}`,
    "",
    "已保存 story_concept：",
    `- workTitle：${input.concept.workTitle}`,
    `- logline：${input.concept.logline}`,
    `- premise：${input.concept.premise}`,
    `- protagonist：${input.concept.protagonist}`,
    `- protagonistGoal：${input.concept.protagonistGoal}`,
    `- protagonistWeakness：${input.concept.protagonistWeakness}`,
    `- antagonistOrObstacle：${input.concept.antagonistOrObstacle}`,
    `- worldRules：${input.concept.worldRules}`,
    `- surfaceConflict：${input.concept.surfaceConflict}`,
    `- middleConflict：${input.concept.middleConflict}`,
    `- deepConflict：${input.concept.deepConflict}`,
    `- firstVolumeHook：${input.concept.firstVolumeHook}`,
    `- readerHookQuestions：${input.concept.readerHookQuestions.join("；")}`,
    "",
    "已保存 story_bible：",
    `- worldview：${input.bible.worldview}`,
    `- powerSystem：${input.bible.powerSystem}`,
    `- majorFactions：${input.bible.majorFactions}`,
    `- mainPlot：${input.bible.mainPlot}`,
    `- firstVolumePlot：${input.bible.firstVolumePlot}`,
    `- protagonistArc：${input.bible.protagonistArc}`,
    `- antagonistPlan：${input.bible.antagonistPlan}`,
    `- midLateForeshadowing：${input.bible.midLateForeshadowing}`,
    `- finalTruth：${input.bible.finalTruth}`,
    `- immutableRules：${input.bible.immutableRules.join("；")}`,
    "",
    "已保存 characters：",
    ...input.characters.map((character, index) =>
      [
        `角色 ${index + 1}：${character.name}`,
        `  - role：${character.role}`,
        `  - goal：${character.goal}`,
        `  - weakness：${character.weakness}`,
        `  - secret：${character.secret}`,
        `  - relationshipToProtagonist：${character.relationshipToProtagonist}`,
        `  - characterArc：${character.characterArc}`,
      ].join("\n"),
    ),
    "",
    "章节大纲字段要求：",
    "- volume 必须包含 volumeNumber、title、summary、mainConflict、endingHook。",
    "- chapters 每一项必须包含 chapterNumber、title、event、conflict、characterChange、highlight、foreshadowing、endingHook、estimatedWords。",
    "- chapterNumber 必须从 1 到 20 连续，不能跳号，不能重复。",
    "- event/conflict/characterChange/highlight/foreshadowing/endingHook 都只写大纲，不写正文段落。",
    "",
    "目标 JSON 结构示例（最终答案必须是同结构 JSON object，不要照抄示例内容）：",
    outlineJsonStructureExample,
  ].join("\n");
}
