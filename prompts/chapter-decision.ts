import type { CharacterCard, StoryBible } from "@/prompts/bible";
import type { StoryConcept } from "@/prompts/concept";
import type { ChapterOutline, VolumeOutline } from "@/prompts/outline";

export const CHAPTER_DECISION_PROMPT_VERSION = "chapter-decision-v1";
export const CHAPTER_DECISION_OPTION_IDS = ["A", "B", "C"] as const;
export const CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT = 500;

export type ChapterDecisionOptionId = (typeof CHAPTER_DECISION_OPTION_IDS)[number];

export type ChapterDecisionOption = {
  id: ChapterDecisionOptionId;
  label: string;
  description: string;
  expectedEffects: string[];
};

export type ChapterDecision = {
  question: string;
  options: ChapterDecisionOption[];
  selectedOptionId: ChapterDecisionOptionId | null;
  customChoice: string;
  selectedAt: string | null;
};

export type ChapterDecisionPreviousContext = ChapterOutline & {
  summaryText: string | null;
};

export type ChapterDecisionPromptInput = {
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
  previousChapters: ChapterDecisionPreviousContext[];
};

type ValidationResult =
  | { ok: true; decision: ChapterDecision }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isOptionId(value: unknown): value is ChapterDecisionOptionId {
  return CHAPTER_DECISION_OPTION_IDS.includes(value as ChapterDecisionOptionId);
}

function normalizeEffects(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(item, 120))
    .filter(Boolean)
    .slice(0, 5);
}

export function validateChapterDecisionOutput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "decision 必须是 JSON object。" };
  }

  const question = cleanText(value.question, 160);

  if (!question) {
    return { ok: false, error: "decision.question 不能为空。" };
  }

  if (!Array.isArray(value.options) || value.options.length !== 3) {
    return { ok: false, error: "decision.options 必须包含 3 个选项。" };
  }

  const options = value.options.map((item, index) => {
    if (!isRecord(item)) {
      return null;
    }

    const id = item.id;

    if (id !== CHAPTER_DECISION_OPTION_IDS[index]) {
      return null;
    }

    const label = cleanText(item.label, 40);
    const description = cleanText(item.description, 180);
    const expectedEffects = normalizeEffects(item.expectedEffects);

    if (!label || !description || expectedEffects.length === 0) {
      return null;
    }

    return {
      id,
      label,
      description,
      expectedEffects,
    };
  });

  if (options.some((option) => !option)) {
    return {
      ok: false,
      error: "decision.options 必须严格使用 A/B/C，且包含 label/description/expectedEffects。",
    };
  }

  return {
    ok: true,
    decision: {
      question,
      options: options as ChapterDecisionOption[],
      selectedOptionId: null,
      customChoice: "",
      selectedAt: null,
    },
  };
}

export function normalizeChapterDecision(value: unknown): ChapterDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  const validation = validateChapterDecisionOutput(value);

  if (!validation.ok) {
    return null;
  }

  const optionIds = new Set(validation.decision.options.map((option) => option.id));
  const selectedOptionId =
    isOptionId(value.selectedOptionId) && optionIds.has(value.selectedOptionId)
      ? value.selectedOptionId
      : null;
  const customChoice = cleanText(value.customChoice, CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT);
  const selectedAt = cleanText(value.selectedAt, 80);

  return {
    ...validation.decision,
    selectedOptionId,
    customChoice,
    selectedAt: selectedAt || null,
  };
}

export function hasSelectedChapterDecision(decision: ChapterDecision | null | undefined) {
  return Boolean(decision?.selectedOptionId || decision?.customChoice);
}

export function formatSelectedChapterDecision(decision: ChapterDecision | null | undefined) {
  if (!decision || !hasSelectedChapterDecision(decision)) {
    return "无已保存选择。可以按导演指令和章节大纲生成。";
  }

  const selectedOption = decision.selectedOptionId
    ? decision.options.find((option) => option.id === decision.selectedOptionId)
    : null;

  return [
    `互动问题：${decision.question}`,
    selectedOption
      ? `用户选择：${selectedOption.id}. ${selectedOption.label} - ${selectedOption.description}`
      : "用户选择：未选择 A/B/C。",
    selectedOption
      ? `预期影响：${selectedOption.expectedEffects.join("；")}`
      : "预期影响：按自定义选择推进。",
    decision.customChoice ? `自定义选择：${decision.customChoice}` : "自定义选择：无。",
    "写正文时必须明显吸收上述剧情方向，但不能违背故事圣经、角色卡和当前章节大纲。",
  ].join("\n");
}

function formatCharacters(characters: CharacterCard[]) {
  return characters
    .map((character, index) =>
      [
        `角色 ${index + 1}：${character.name}`,
        `- 定位：${character.role}`,
        `- 性格：${character.personality}`,
        `- 目标：${character.goal}`,
        `- 弱点：${character.weakness}`,
        `- 秘密：${character.secret}`,
        `- 与主角关系：${character.relationshipToProtagonist}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function formatPreviousChapters(previousChapters: ChapterDecisionPreviousContext[]) {
  if (previousChapters.length === 0) {
    return "无。当前是第一章。";
  }

  return previousChapters
    .map((chapter) =>
      [
        `第 ${chapter.chapterNumber} 章《${chapter.title}》`,
        `- 大纲事件：${chapter.event}`,
        `- 大纲冲突：${chapter.conflict}`,
        `- 摘要：${chapter.summaryText || "暂无摘要，仅参考大纲。"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function buildChapterDecisionPrompt(input: ChapterDecisionPromptInput) {
  return [
    "你是互动小说剧情设计师。请基于当前项目上下文，为当前章节生成 3 个读完本章后出现的章末抉择。",
    "",
    "硬性输出要求：",
    "- 只输出一个 JSON object。",
    "- 不要 Markdown，不要代码块，不要解释，不要多余前后缀。",
    "- 必须严格符合示例结构。",
    "- 只能生成当前章节读完后的章末抉择，不要生成后续章节正文，不要生成状态系统、路线图或多分支树。",
    "- 3 个选项必须都能服务当前 chapter outline，并且要产生不同的角色关系、风险或悬念效果。",
    "- 所有字符串字段必须是单行短句，不要在 JSON string 中输出裸换行、制表符或控制字符。",
    "",
    "JSON 结构示例：",
    JSON.stringify(
      {
        question: "本章主角是否要向同伴坦白能力代价？",
        options: [
          {
            id: "A",
            label: "坦白代价",
            description: "主角主动告诉同伴能力会吞噬记忆。",
            expectedEffects: ["同伴信任上升", "组织怀疑增加", "主角暴露风险提高"],
          },
          {
            id: "B",
            label: "继续隐瞒",
            description: "主角选择把代价藏起来，只独自承受。",
            expectedEffects: ["短期安全", "同伴关系出现裂痕", "后续误会加深"],
          },
          {
            id: "C",
            label: "半真半假",
            description: "主角透露部分真相，但隐瞒最危险的部分。",
            expectedEffects: ["同伴暂时相信", "后续真相暴露会反噬", "悬疑感增强"],
          },
        ],
      },
      null,
      2,
    ),
    "",
    "项目：",
    `- 标题：${input.project.title}`,
    `- 简介：${input.project.description || "未填写"}`,
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
    "作品设定：",
    `- ${input.concept.logline}`,
    `- ${input.concept.premise}`,
    `- 主角：${input.concept.protagonist}`,
    `- 第一卷钩子：${input.concept.firstVolumeHook}`,
    "",
    "故事圣经：",
    `- 世界观：${input.bible.worldview}`,
    `- 力量系统：${input.bible.powerSystem}`,
    `- 主线：${input.bible.mainPlot}`,
    `- 第一卷主线：${input.bible.firstVolumePlot}`,
    `- 不可变规则：${input.bible.immutableRules.join("；")}`,
    "",
    "角色卡：",
    formatCharacters(input.characters),
    "",
    "第一卷：",
    `- ${input.volume.title}`,
    `- 摘要：${input.volume.summary}`,
    `- 主冲突：${input.volume.mainConflict}`,
    `- 结尾钩子：${input.volume.endingHook}`,
    "",
    "前文：",
    formatPreviousChapters(input.previousChapters),
    "",
    "当前章节大纲：",
    `- 第 ${input.chapter.chapterNumber} 章《${input.chapter.title}》`,
    `- 事件：${input.chapter.event}`,
    `- 冲突：${input.chapter.conflict}`,
    `- 角色变化：${input.chapter.characterChange}`,
    `- 看点：${input.chapter.highlight}`,
    `- 伏笔：${input.chapter.foreshadowing}`,
    `- 结尾钩子：${input.chapter.endingHook}`,
    "",
    "现在输出本章章末抉择 JSON。",
  ].join("\n");
}
