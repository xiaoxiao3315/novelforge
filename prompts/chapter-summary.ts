import type { ChapterOutline } from "@/prompts/outline";

export const CHAPTER_SUMMARY_PROMPT_VERSION = "chapter-summary-v3";

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

type SummarySchemaKey = (typeof summarySchemaKeys)[number];

const summaryArraySchemaKeys = [
  "keyEvents",
  "characterStateChanges",
  "relationshipChanges",
  "foreshadowingAndClues",
  "unresolvedQuestions",
  "continuityNotes",
] as const satisfies readonly SummarySchemaKey[];

const summaryStringSchemaKeys = ["endingState"] as const satisfies readonly SummarySchemaKey[];
const summarySchemaKeySet = new Set<string>(summarySchemaKeys);

export type ChapterSummaryValidationFailure = {
  error: string;
  missingFields: string[];
  extraFields: string[];
  invalidFields: string[];
  repairable: boolean;
};

export type ChapterSummaryRepairResult =
  | {
      ok: true;
      summary: SummaryPayload;
      missingFields: string[];
      repairedFields: string[];
    }
  | {
      ok: false;
      error: string;
      missingFields: string[];
      repairedFields: string[];
    };

export type ChapterSummaryRetryPromptInput = {
  originalPrompt: string;
  validationError: string;
  missingFields: string[];
  rawPreview: string;
};

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

function getExtraSummaryKeys(value: Record<string, unknown>) {
  return Object.keys(value).filter((key) => !summarySchemaKeySet.has(key));
}

function getMissingSummaryKeys(value: Record<string, unknown>) {
  return summarySchemaKeys.filter((key) => !(key in value));
}

function getInvalidSummaryFields(value: Record<string, unknown>) {
  const invalidFields: string[] = [];

  for (const key of summaryArraySchemaKeys) {
    if (key in value && !Array.isArray(value[key])) {
      invalidFields.push(key);
    }
  }

  for (const key of summaryStringSchemaKeys) {
    if (key in value && typeof value[key] !== "string") {
      invalidFields.push(key);
    }
  }

  return invalidFields;
}

function validateExactKeys(value: Record<string, unknown>, allowedKeys: Set<string>) {
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (extraKeys.length > 0) {
    return `summary 包含 schema 外字段：${extraKeys.join(", ")}。`;
  }

  return "";
}

function normalizeSummaryPayload(
  value: unknown,
  options: { allowEmptyDefaults?: boolean } = {},
): SummaryPayload | null {
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

  const hasEmptyValue =
    keyEvents.length === 0 ||
    characterStateChanges.length === 0 ||
    relationshipChanges.length === 0 ||
    foreshadowingAndClues.length === 0 ||
    unresolvedQuestions.length === 0 ||
    !endingState ||
    continuityNotes.length === 0;

  if (hasEmptyValue && !options.allowEmptyDefaults) {
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

  if (getMissingSummaryKeys(value).length > 0 || getInvalidSummaryFields(value).length > 0) {
    return null;
  }

  const payload = normalizeSummaryPayload(value, { allowEmptyDefaults: true });
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
): { ok: true; summary: SummaryPayload } | ({ ok: false } & ChapterSummaryValidationFailure) {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "章节摘要输出必须是 JSON object。",
      missingFields: [],
      extraFields: [],
      invalidFields: [],
      repairable: false,
    };
  }

  const exactKeyError = validateExactKeys(value, summarySchemaKeySet);

  if (exactKeyError) {
    return {
      ok: false,
      error: exactKeyError,
      missingFields: [],
      extraFields: getExtraSummaryKeys(value),
      invalidFields: [],
      repairable: false,
    };
  }

  const missingKeys = getMissingSummaryKeys(value);

  if (missingKeys.length > 0) {
    return {
      ok: false,
      error: `summary 缺少字段：${missingKeys.join(", ")}。`,
      missingFields: [...missingKeys],
      extraFields: [],
      invalidFields: [],
      repairable: true,
    };
  }

  const invalidFields = getInvalidSummaryFields(value);

  if (invalidFields.length > 0) {
    return {
      ok: false,
      error: `summary 字段类型错误：${invalidFields.join(", ")}。`,
      missingFields: [],
      extraFields: [],
      invalidFields,
      repairable: false,
    };
  }

  const summary = normalizeSummaryPayload(value);

  if (!summary) {
    return {
      ok: false,
      error: "章节摘要字段必须非空，数组字段至少包含一条有效文本。",
      missingFields: [],
      extraFields: [],
      invalidFields: [],
      repairable: false,
    };
  }

  return { ok: true, summary };
}

export function repairChapterSummaryOutput(value: unknown): ChapterSummaryRepairResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "章节摘要输出必须是 JSON object，不能安全修复。",
      missingFields: [],
      repairedFields: [],
    };
  }

  const extraKeys = getExtraSummaryKeys(value);

  if (extraKeys.length > 0) {
    return {
      ok: false,
      error: `summary 包含 schema 外字段，不能安全修复：${extraKeys.join(", ")}。`,
      missingFields: [],
      repairedFields: [],
    };
  }

  const invalidFields = getInvalidSummaryFields(value);

  if (invalidFields.length > 0) {
    return {
      ok: false,
      error: `summary 字段类型错误，不能安全修复：${invalidFields.join(", ")}。`,
      missingFields: [],
      repairedFields: [],
    };
  }

  const missingFields = getMissingSummaryKeys(value);

  if (missingFields.length === 0) {
    return {
      ok: false,
      error: "summary 没有可安全修复的缺失字段。",
      missingFields: [],
      repairedFields: [],
    };
  }

  const repaired: Record<string, unknown> = { ...value };
  const repairedFields: string[] = [];

  for (const field of missingFields) {
    repaired[field] = summaryStringSchemaKeys.includes(field as (typeof summaryStringSchemaKeys)[number])
      ? ""
      : [];
    repairedFields.push(field);
  }

  const summary = normalizeSummaryPayload(repaired, { allowEmptyDefaults: true });

  if (!summary) {
    return {
      ok: false,
      error: "summary 缺失字段已补齐，但仍无法规范化。",
      missingFields: [...missingFields],
      repairedFields,
    };
  }

  return {
    ok: true,
    summary,
    missingFields: [...missingFields],
    repairedFields,
  };
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

export function buildChapterSummaryRetryPrompt(input: ChapterSummaryRetryPromptInput) {
  return [
    "上一轮章节摘要 JSON 已经可以解析，但没有通过 schema 校验。请根据校验错误重新输出完整 summary JSON。",
    "",
    "校验错误：",
    input.validationError,
    "",
    `缺失字段：${input.missingFields.length > 0 ? input.missingFields.join(", ") : "无"}`,
    "",
    "必须严格满足：",
    "- 顶层只包含 keyEvents、characterStateChanges、relationshipChanges、foreshadowingAndClues、unresolvedQuestions、endingState、continuityNotes。",
    "- 七个字段必须全部出现，即使某类信息很少也不能省略字段。",
    "- 数组字段必须输出 string[]；没有可靠信息时输出 []。",
    "- endingState 必须输出 string；没有可靠信息时输出空字符串。",
    "- 不要输出 Markdown、解释或 JSON 之外的文本。",
    "",
    "上一轮输出预览：",
    input.rawPreview,
    "",
    "原始摘要任务：",
    input.originalPrompt,
  ].join("\n");
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
    "- 只输出一个 JSON object，首字符必须是 {，末字符必须是 }。",
    "- 不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
    "- 必须严格符合目标 JSON 结构，顶层只能包含示例中的 7 个字段。",
    "- 七个字段必须全部出现：keyEvents、characterStateChanges、relationshipChanges、foreshadowingAndClues、unresolvedQuestions、endingState、continuityNotes。",
    "- 数组字段必须输出 string[]；没有可靠信息时输出 []。endingState 必须输出 string；没有可靠信息时输出空字符串。",
    "- 所有字符串字段必须是单行短句，不要在 JSON string 中输出裸换行、制表符或任何控制字符。",
    "- 如果需要多条信息，使用数组，每项只写一条单行短句。",
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
