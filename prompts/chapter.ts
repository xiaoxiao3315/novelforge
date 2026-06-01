import type { CharacterCard, StoryBible } from "@/prompts/bible";
import type { StoryConcept } from "@/prompts/concept";
import {
  normalizeChapterOutlines,
  type ChapterOutline,
  type VolumeOutline,
} from "@/prompts/outline";

export const CHAPTER_PROMPT_VERSION = "chapter-v1";
export const DEFAULT_CHAPTER_WORD_TARGET = 2500;

export type ChapterDraft = {
  body: string;
  generatedAt: string;
  model: string;
  promptVersion: string;
  wordTarget: number;
};

export type ChapterContent = ChapterOutline & {
  draft?: ChapterDraft;
};

export type PreviousChapterContext = ChapterOutline & {
  draftExcerpt: string | null;
};

export type ChapterPromptInput = {
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
  volume: VolumeOutline;
  chapter: ChapterOutline;
  previousChapters: PreviousChapterContext[];
  wordTarget: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 200000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function excerptText(value: string, maxLength = 900) {
  const cleaned = value.trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const headLength = Math.floor(maxLength * 0.55);
  const tailLength = maxLength - headLength;

  return `${cleaned.slice(0, headLength)}\n...\n${cleaned.slice(-tailLength)}`;
}

export function normalizeChapterDraft(value: unknown): ChapterDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const body = cleanText(value.body);
  const generatedAt = cleanText(value.generatedAt, 80);
  const model = cleanText(value.model, 120);
  const promptVersion = cleanText(value.promptVersion, 80);
  const wordTarget = value.wordTarget;

  if (
    !body ||
    !generatedAt ||
    !model ||
    !promptVersion ||
    typeof wordTarget !== "number" ||
    !Number.isInteger(wordTarget) ||
    wordTarget <= 0
  ) {
    return null;
  }

  return {
    body,
    generatedAt,
    model,
    promptVersion,
    wordTarget,
  };
}

export function normalizeChapterContent(value: unknown): ChapterContent | null {
  if (!isRecord(value)) {
    return null;
  }

  const outline = normalizeChapterOutlines([value])[0];

  if (!outline) {
    return null;
  }

  const draft = normalizeChapterDraft(value.draft);

  return {
    ...outline,
    ...(draft ? { draft } : {}),
  };
}

export function normalizeChapterContents(value: unknown): ChapterContent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeChapterContent)
    .filter((item): item is ChapterContent => Boolean(item))
    .sort((left, right) => left.chapterNumber - right.chapterNumber);
}

export function buildChapterDraft(
  body: string,
  model: string,
  wordTarget = DEFAULT_CHAPTER_WORD_TARGET,
): ChapterDraft {
  return {
    body,
    generatedAt: new Date().toISOString(),
    model,
    promptVersion: CHAPTER_PROMPT_VERSION,
    wordTarget,
  };
}

export function buildChapterContent(
  chapter: ChapterOutline,
  draft: ChapterDraft,
  existingContent: unknown,
): ChapterContent {
  const existing = isRecord(existingContent) ? existingContent : {};

  return {
    ...existing,
    ...chapter,
    draft,
  };
}

export function buildPreviousChapterContext(
  chapter: ChapterOutline,
  content: unknown,
): PreviousChapterContext {
  const draft = isRecord(content) ? normalizeChapterDraft(content.draft) : null;

  return {
    ...chapter,
    draftExcerpt: draft ? excerptText(draft.body) : null,
  };
}

function formatCharacters(characters: CharacterCard[]) {
  return characters
    .map((character, index) =>
      [
        `角色 ${index + 1}：${character.name}`,
        `  - role：${character.role}`,
        `  - appearance：${character.appearance}`,
        `  - personality：${character.personality}`,
        `  - goal：${character.goal}`,
        `  - weakness：${character.weakness}`,
        `  - secret：${character.secret}`,
        `  - relationshipToProtagonist：${character.relationshipToProtagonist}`,
        `  - characterArc：${character.characterArc}`,
      ].join("\n"),
    )
    .join("\n");
}

function formatPreviousChapters(previousChapters: PreviousChapterContext[]) {
  if (previousChapters.length === 0) {
    return "无。当前是第一章，不要虚构已经发生的正文。";
  }

  return previousChapters
    .map((chapter) =>
      [
        `第 ${chapter.chapterNumber} 章《${chapter.title}》`,
        `- 大纲事件：${chapter.event}`,
        `- 大纲冲突：${chapter.conflict}`,
        `- 角色变化：${chapter.characterChange}`,
        `- 看点：${chapter.highlight}`,
        `- 伏笔：${chapter.foreshadowing}`,
        `- 结尾钩子：${chapter.endingHook}`,
        chapter.draftExcerpt
          ? `- 已生成正文节选：${chapter.draftExcerpt}`
          : "- 尚无正文摘要或正文节选，仅按本章大纲作为前文信息。",
      ].join("\n"),
    )
    .join("\n\n");
}

export function buildChapterPrompt(input: ChapterPromptInput) {
  return [
    "你是严谨的中文长篇网文单章正文作者。请基于已保存的项目设定、故事圣经、角色卡、第一卷信息、当前章节大纲和前文信息，只生成当前一章正文。",
    "",
    "硬性要求：",
    `- 默认生成当前章约 ${input.wordTarget} 字中文小说正文。`,
    "- 只写当前章正文，不写章节大纲，不写解释，不写前言或后记。",
    "- 不提前生成下一章，不总结整本小说，不输出 Markdown，不使用代码块。",
    "- 不得生成 TipTap、改写、续写、多章批量、收费、社区、排行榜、AI 绘图或漫画分镜相关内容。",
    "- 必须完成当前章节大纲中的事件、冲突、看点、伏笔和角色变化。",
    "- 不得违背 story_bible 的不可变规则、世界观、力量系统、角色卡和第一卷主线。",
    "- 结尾必须保留明确的悬念或情绪钩子，但不能直接进入下一章正文。",
    "- 文风必须符合项目 tone / genre，内容必须是中文小说正文。",
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
    formatCharacters(input.characters),
    "",
    "已保存 volume：",
    `- volumeNumber：${input.volume.volumeNumber}`,
    `- title：${input.volume.title}`,
    `- summary：${input.volume.summary}`,
    `- mainConflict：${input.volume.mainConflict}`,
    `- endingHook：${input.volume.endingHook}`,
    "",
    "前文信息：",
    formatPreviousChapters(input.previousChapters),
    "",
    "当前 chapter outline：",
    `- chapterNumber：${input.chapter.chapterNumber}`,
    `- title：${input.chapter.title}`,
    `- event：${input.chapter.event}`,
    `- conflict：${input.chapter.conflict}`,
    `- characterChange：${input.chapter.characterChange}`,
    `- highlight：${input.chapter.highlight}`,
    `- foreshadowing：${input.chapter.foreshadowing}`,
    `- endingHook：${input.chapter.endingHook}`,
    `- estimatedWords：${input.chapter.estimatedWords}`,
    "",
    "现在只输出当前章中文小说正文。",
  ].join("\n");
}
