import type { ChapterOutline } from "@/prompts/outline";

export const CHAPTER_SUMMARY_PROMPT_VERSION = "chapter-summary-v1";

export type ChapterSummary = {
  keyEvents: string[];
  characterStateChanges: string[];
  relationshipChanges: string[];
  foreshadowingAndClues: string[];
  unresolvedQuestions: string[];
  endingState: string;
  continuityNotes: string[];
  generatedAt: string;
  model: string;
  promptVersion: string;
};

export type PreviousChapterSummaryContext = ChapterOutline & {
  summary: ChapterSummary | null;
};

export type ChapterSummaryPromptInput = {
  chapter: ChapterOutline;
  body: string;
  previousSummaries: PreviousChapterSummaryContext[];
};

type SummaryPayload = Omit<ChapterSummary, "generatedAt" | "model" | "promptVersion">;

const summarySchemaKeys = [
  "keyEvents",
  "characterStateChanges",
  "relationshipChanges",
  "foreshadowingAndClues",
  "unresolvedQuestions",
  "endingState",
  "continuityNotes",
] as const;

const summarySchemaKeySet = new Set<string>(summarySchemaKeys);

const summaryJsonStructureExample = JSON.stringify(
  {
    keyEvents: ["本章已经真实发生的关键事件，按发生顺序写。"],
    characterStateChanges: ["角色的能力、心理、处境、目标或身份变化。"],
    relationshipChanges: ["角色关系、信任、敌意、盟友或误会的变化。"],
    foreshadowingAndClues: ["本章新埋下或回收的伏笔、线索、世界规则证据。"],
    unresolvedQuestions: ["章末仍未解决、后续必须记住的悬念。"],
    endingState: "本章结尾时人物位置、情绪、危机和局面状态。",
    continuityNotes: ["下一章生成必须参考的连续性提醒。"],
  },
  null,
  2,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 1200) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanTextArray(value: unknown, maxItems: number, maxItemLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function validateExactKeys(value: Record<string, unknown>, allowedKeys: Set<string>) {
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (extraKeys.length > 0) {
    return `summary 包含 schema 外字段：${extraKeys.join(", ")}。`;
  }

  return "";
}

function normalizeSummaryPayload(value: unknown): SummaryPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const keyEvents = cleanTextArray(value.keyEvents, 8, 360);
  const characterStateChanges = cleanTextArray(value.characterStateChanges, 8, 360);
  const relationshipChanges = cleanTextArray(value.relationshipChanges, 8, 360);
  const foreshadowingAndClues = cleanTextArray(value.foreshadowingAndClues, 8, 360);
  const unresolvedQuestions = cleanTextArray(value.unresolvedQuestions, 8, 360);
  const endingState = cleanText(value.endingState, 700);
  const continuityNotes = cleanTextArray(value.continuityNotes, 10, 360);

  if (
    keyEvents.length === 0 ||
    characterStateChanges.length === 0 ||
    relationshipChanges.length === 0 ||
    foreshadowingAndClues.length === 0 ||
    unresolvedQuestions.length === 0 ||
    !endingState ||
    continuityNotes.length === 0
  ) {
    return null;
  }

  return {
    keyEvents,
    characterStateChanges,
    relationshipChanges,
    foreshadowingAndClues,
    unresolvedQuestions,
    endingState,
    continuityNotes,
  };
}

export function normalizeChapterSummary(value: unknown): ChapterSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const payload = normalizeSummaryPayload(value);
  const generatedAt = cleanText(value.generatedAt, 80);
  const model = cleanText(value.model, 120);
  const promptVersion = cleanText(value.promptVersion, 80);

  if (!payload || !generatedAt || !model || !promptVersion) {
    return null;
  }

  return {
    ...payload,
    generatedAt,
    model,
    promptVersion,
  };
}

export function validateChapterSummaryOutput(
  value: unknown,
): { ok: true; summary: SummaryPayload } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "章节摘要输出必须是 JSON object。" };
  }

  const exactKeyError = validateExactKeys(value, summarySchemaKeySet);

  if (exactKeyError) {
    return { ok: false, error: exactKeyError };
  }

  const missingKeys = summarySchemaKeys.filter((key) => !(key in value));

  if (missingKeys.length > 0) {
    return { ok: false, error: `summary 缺少字段：${missingKeys.join(", ")}。` };
  }

  const summary = normalizeSummaryPayload(value);

  if (!summary) {
    return {
      ok: false,
      error: "章节摘要字段必须非空，数组字段至少包含一条有效文本。",
    };
  }

  return { ok: true, summary };
}

export function buildChapterSummary(
  summary: SummaryPayload,
  model: string,
): ChapterSummary {
  return {
    ...summary,
    generatedAt: new Date().toISOString(),
    model,
    promptVersion: CHAPTER_SUMMARY_PROMPT_VERSION,
  };
}

function formatPreviousSummaries(previousSummaries: PreviousChapterSummaryContext[]) {
  if (previousSummaries.length === 0) {
    return "无。当前章节前没有已保存章节摘要。";
  }

  return previousSummaries
    .map((chapter) => {
      if (!chapter.summary) {
        return [
          `第 ${chapter.chapterNumber} 章《${chapter.title}》`,
          `- 大纲事件：${chapter.event}`,
          "- 尚无已保存摘要。",
        ].join("\n");
      }

      return [
        `第 ${chapter.chapterNumber} 章《${chapter.title}》`,
        `- 已发生事件：${chapter.summary.keyEvents.join("；")}`,
        `- 角色状态变化：${chapter.summary.characterStateChanges.join("；")}`,
        `- 关系变化：${chapter.summary.relationshipChanges.join("；")}`,
        `- 伏笔和线索：${chapter.summary.foreshadowingAndClues.join("；")}`,
        `- 未解决悬念：${chapter.summary.unresolvedQuestions.join("；")}`,
        `- 结尾状态：${chapter.summary.endingState}`,
        `- 下一章上下文：${chapter.summary.continuityNotes.join("；")}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildChapterSummaryPrompt(input: ChapterSummaryPromptInput) {
  return [
    "你是中文长篇小说连续性编辑。请只基于当前章节正文和章节大纲生成本章连续性摘要。",
    "",
    "硬性要求：",
    "- 只总结当前一章，不生成正文，不续写，不改写，不生成整本小说。",
    "- 摘要必须为后续章节生成服务，重点记录已发生事件、人物状态、关系变化、伏笔、未解决悬念和结尾状态。",
    "- 不要编造正文中没有发生的事实；不确定的信息写成待确认悬念。",
    "- 只输出 JSON object，不要 Markdown，不要代码块，不要解释。",
    "- 必须严格符合目标 JSON 结构，顶层只能包含示例中的 7 个字段。",
    "",
    "前文已保存摘要：",
    formatPreviousSummaries(input.previousSummaries),
    "",
    "当前章节大纲：",
    `- chapterNumber：${input.chapter.chapterNumber}`,
    `- title：${input.chapter.title}`,
    `- event：${input.chapter.event}`,
    `- conflict：${input.chapter.conflict}`,
    `- characterChange：${input.chapter.characterChange}`,
    `- highlight：${input.chapter.highlight}`,
    `- foreshadowing：${input.chapter.foreshadowing}`,
    `- endingHook：${input.chapter.endingHook}`,
    "",
    "当前章节正文：",
    input.body,
    "",
    "目标 JSON 结构示例（最终答案必须是同结构 JSON object，不要照抄示例内容）：",
    summaryJsonStructureExample,
  ].join("\n");
}
