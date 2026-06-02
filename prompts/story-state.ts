import {
  hasSelectedChapterDecision,
  type ChapterDecision,
} from "@/prompts/chapter-decision";

export type StoryRelationshipChange = {
  name: string;
  change: number;
  reason: string;
};

export type StoryMeterChange = {
  name: string;
  change: number;
  reason: string;
};

export type StoryFlagChange = {
  key: string;
  value: boolean;
};

export type StoryClueChange = {
  name: string;
  status: string;
  note: string;
};

export type StoryRouteTendencyChange = {
  name: string;
  change: number;
};

export type StoryStateChanges = {
  relationships: StoryRelationshipChange[];
  meters: StoryMeterChange[];
  flags: StoryFlagChange[];
  clues: StoryClueChange[];
  routeTendency: StoryRouteTendencyChange[];
};

export type InteractiveStoryState = {
  relationships: Record<string, number>;
  meters: Record<string, number>;
  flags: Record<string, boolean>;
  clues: Record<string, string>;
  routeTendency: Record<string, number>;
};

export const EMPTY_STORY_STATE_CHANGES: StoryStateChanges = {
  relationships: [],
  meters: [],
  flags: [],
  clues: [],
  routeTendency: [],
};

export const EMPTY_INTERACTIVE_STORY_STATE: InteractiveStoryState = {
  relationships: {},
  meters: {},
  flags: {},
  clues: {},
  routeTendency: {},
};

const STATE_VALUE_MIN = 0;
const STATE_VALUE_MAX = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanNumber(value: unknown, min = -100, max = 100) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampStateValue(value: number) {
  return Math.max(STATE_VALUE_MIN, Math.min(STATE_VALUE_MAX, Math.round(value)));
}

function normalizeNumberMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [cleanText(key, 60), clampStateValue(cleanNumber(item, 0, 100))])
      .filter(([key]) => Boolean(key)),
  );
}

function normalizeBooleanMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [cleanText(key, 80), Boolean(item)])
      .filter(([key]) => Boolean(key)),
  );
}

function normalizeStringMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [cleanText(key, 80), cleanText(item, 80)])
      .filter(([key, item]) => Boolean(key && item)),
  );
}

export function normalizeInteractiveStoryState(value: unknown): InteractiveStoryState {
  if (!isRecord(value)) {
    return EMPTY_INTERACTIVE_STORY_STATE;
  }

  return {
    relationships: normalizeNumberMap(value.relationships),
    meters: normalizeNumberMap(value.meters),
    flags: normalizeBooleanMap(value.flags),
    clues: normalizeStringMap(value.clues),
    routeTendency: normalizeNumberMap(value.routeTendency),
  };
}

function normalizeRelationshipChange(value: unknown): StoryRelationshipChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = cleanText(value.name, 60);
  const reason = cleanText(value.reason, 160);

  if (!name) {
    return null;
  }

  return {
    name,
    change: cleanNumber(value.change, -30, 30),
    reason: reason || "用户章末选择带来的关系变化。",
  };
}

function normalizeMeterChange(value: unknown): StoryMeterChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = cleanText(value.name, 60);
  const reason = cleanText(value.reason, 160);

  if (!name) {
    return null;
  }

  return {
    name,
    change: cleanNumber(value.change, -30, 30),
    reason: reason || "用户章末选择带来的风险变化。",
  };
}

function normalizeFlagChange(value: unknown): StoryFlagChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = cleanText(value.key, 80);

  if (!key) {
    return null;
  }

  return {
    key,
    value: Boolean(value.value),
  };
}

function normalizeClueChange(value: unknown): StoryClueChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = cleanText(value.name, 80);
  const status = cleanText(value.status, 80);
  const note = cleanText(value.note, 160);

  if (!name || !status) {
    return null;
  }

  return {
    name,
    status,
    note: note || "用户章末选择推进了该线索。",
  };
}

function normalizeRouteTendencyChange(value: unknown): StoryRouteTendencyChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = cleanText(value.name, 60);

  if (!name) {
    return null;
  }

  return {
    name,
    change: cleanNumber(value.change, -30, 30),
  };
}

function normalizeArray<T>(value: unknown, normalize: (item: unknown) => T | null) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalize).filter((item): item is T => Boolean(item)).slice(0, 12);
}

export function normalizeStoryStateChanges(value: unknown): StoryStateChanges {
  if (!isRecord(value)) {
    return EMPTY_STORY_STATE_CHANGES;
  }

  return {
    relationships: normalizeArray(value.relationships, normalizeRelationshipChange),
    meters: normalizeArray(value.meters, normalizeMeterChange),
    flags: normalizeArray(value.flags, normalizeFlagChange),
    clues: normalizeArray(value.clues, normalizeClueChange),
    routeTendency: normalizeArray(value.routeTendency, normalizeRouteTendencyChange),
  };
}

export function hasStoryStateChanges(value: StoryStateChanges | null | undefined) {
  if (!value) {
    return false;
  }

  return (
    value.relationships.length > 0 ||
    value.meters.length > 0 ||
    value.flags.length > 0 ||
    value.clues.length > 0 ||
    value.routeTendency.length > 0
  );
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getSelectedDecisionText(decision: ChapterDecision) {
  const selectedOption = decision.selectedOptionId
    ? decision.options.find((option) => option.id === decision.selectedOptionId)
    : null;

  return [
    decision.question,
    selectedOption?.label,
    selectedOption?.description,
    ...(selectedOption?.expectedEffects ?? []),
    decision.customChoice,
  ]
    .filter(Boolean)
    .join(" ");
}

function getDecisionLabel(decision: ChapterDecision) {
  const selectedOption = decision.selectedOptionId
    ? decision.options.find((option) => option.id === decision.selectedOptionId)
    : null;

  if (selectedOption) {
    return `${selectedOption.id}.${selectedOption.label}`;
  }

  return decision.customChoice.slice(0, 24) || "自定义选择";
}

export function buildStoryStateChanges(decision: ChapterDecision): StoryStateChanges {
  if (!hasSelectedChapterDecision(decision)) {
    return EMPTY_STORY_STATE_CHANGES;
  }

  const text = getSelectedDecisionText(decision);
  const decisionLabel = getDecisionLabel(decision);
  const relationships: StoryRelationshipChange[] = [];
  const meters: StoryMeterChange[] = [];
  const flags: StoryFlagChange[] = [
    {
      key: `命运分歧:${decisionLabel}`,
      value: true,
    },
  ];
  const clues: StoryClueChange[] = [];
  const routeTendency: StoryRouteTendencyChange[] = [];

  if (includesAny(text, ["坦白", "信任", "同伴", "守护", "结盟", "帮助"])) {
    relationships.push({
      name: "关键同伴信任",
      change: 10,
      reason: "用户选择强化了坦白、信任或守护方向。",
    });
  } else if (includesAny(text, ["隐瞒", "误会", "欺骗", "背叛", "裂痕"])) {
    relationships.push({
      name: "关键同伴信任",
      change: -8,
      reason: "用户选择引入隐瞒或误会，关系承压。",
    });
  } else {
    relationships.push({
      name: "关键同伴关注",
      change: 4,
      reason: "用户选择让同伴关系进入新的观察状态。",
    });
  }

  if (includesAny(text, ["组织", "监察", "怀疑", "暴露", "追踪"])) {
    meters.push({
      name: "组织怀疑度",
      change: 12,
      reason: "选择提高了被外部势力注意的风险。",
    });
  }

  if (includesAny(text, ["能力", "失控", "代价", "暴走", "吞噬"])) {
    meters.push({
      name: "能力失控风险",
      change: 10,
      reason: "选择触及能力代价或失控风险。",
    });
  }

  if (includesAny(text, ["记忆", "遗忘", "回忆", "过去"])) {
    meters.push({
      name: "主角记忆损耗",
      change: 10,
      reason: "选择牵动记忆代价或过去线索。",
    });
  }

  if (meters.length === 0) {
    meters.push({
      name: "主角压力",
      change: 5,
      reason: "章末选择推动剧情，主角承受新的压力。",
    });
  }

  if (includesAny(text, ["线索", "照片", "真相", "调查", "旧", "证据"])) {
    clues.push({
      name: "关键线索",
      status: "已推进",
      note: "选择把注意力推向真相或调查线索。",
    });
  } else {
    clues.push({
      name: "本章抉择方向",
      status: "已记录",
      note: "选择被记录为后续章节的互动上下文。",
    });
  }

  if (includesAny(text, ["真相", "线索", "调查", "坦白", "证据"])) {
    routeTendency.push({ name: "真相线", change: 10 });
  }

  if (includesAny(text, ["守护", "同伴", "救", "信任", "帮助"])) {
    routeTendency.push({ name: "守护线", change: 8 });
  }

  if (includesAny(text, ["隐瞒", "欺骗", "牺牲", "代价", "黑", "复仇"])) {
    routeTendency.push({ name: "黑化线", change: 6 });
  }

  if (routeTendency.length === 0) {
    routeTendency.push({ name: "主线推进", change: 5 });
  }

  return {
    relationships,
    meters,
    flags,
    clues,
    routeTendency,
  };
}

export function applyStoryStateChanges(
  currentState: unknown,
  changes: StoryStateChanges,
): InteractiveStoryState {
  const state = normalizeInteractiveStoryState(currentState);

  return {
    relationships: {
      ...state.relationships,
      ...Object.fromEntries(
        changes.relationships.map((item) => [
          item.name,
          clampStateValue((state.relationships[item.name] ?? 50) + item.change),
        ]),
      ),
    },
    meters: {
      ...state.meters,
      ...Object.fromEntries(
        changes.meters.map((item) => [
          item.name,
          clampStateValue((state.meters[item.name] ?? 0) + item.change),
        ]),
      ),
    },
    flags: {
      ...state.flags,
      ...Object.fromEntries(changes.flags.map((item) => [item.key, item.value])),
    },
    clues: {
      ...state.clues,
      ...Object.fromEntries(changes.clues.map((item) => [item.name, item.status])),
    },
    routeTendency: {
      ...state.routeTendency,
      ...Object.fromEntries(
        changes.routeTendency.map((item) => [
          item.name,
          clampStateValue((state.routeTendency[item.name] ?? 0) + item.change),
        ]),
      ),
    },
  };
}

function formatNumberMap(value: Record<string, number>) {
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return "暂无。";
  }

  return entries.map(([key, item]) => `- ${key}：${item}`).join("\n");
}

function formatBooleanMap(value: Record<string, boolean>) {
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return "暂无。";
  }

  return entries.map(([key, item]) => `- ${key}：${item ? "是" : "否"}`).join("\n");
}

function formatStringMap(value: Record<string, string>) {
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return "暂无。";
  }

  return entries.map(([key, item]) => `- ${key}：${item}`).join("\n");
}

export function formatInteractiveStoryState(value: InteractiveStoryState | null | undefined) {
  if (!value) {
    return "暂无互动状态。";
  }

  return [
    "角色关系：",
    formatNumberMap(value.relationships),
    "",
    "风险/压力计量：",
    formatNumberMap(value.meters),
    "",
    "剧情标记：",
    formatBooleanMap(value.flags),
    "",
    "线索状态：",
    formatStringMap(value.clues),
    "",
    "路线倾向：",
    formatNumberMap(value.routeTendency),
  ].join("\n");
}
