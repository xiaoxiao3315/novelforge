export type PlotFilterOption = {
  value: string;
  label: string;
  description: string;
};

export const themes: PlotFilterOption[] = [
  {
    value: "self-redemption",
    label: "自我救赎",
    description: "主角从失败、亏欠或阴影中重新站起来。",
  },
  {
    value: "power-and-cost",
    label: "力量与代价",
    description: "每一次变强都伴随不可忽视的牺牲。",
  },
  {
    value: "truth-hunt",
    label: "追寻真相",
    description: "故事围绕隐藏真相、旧案或世界秘密展开。",
  },
  {
    value: "found-family",
    label: "羁绊与同盟",
    description: "主角在冲突中建立可信任的小队或家人关系。",
  },
  {
    value: "survival",
    label: "极限生存",
    description: "角色被迫在高压环境中争取活下去的机会。",
  },
];

export const genres: PlotFilterOption[] = [
  {
    value: "urban-fantasy",
    label: "都市奇幻",
    description: "现实城市中存在隐藏组织、异能或超自然事件。",
  },
  {
    value: "xuanhuan",
    label: "玄幻升级",
    description: "以境界、门派、秘境和强者体系推动成长。",
  },
  {
    value: "sci-fi-adventure",
    label: "科幻冒险",
    description: "科技、星际、AI 或未来社会中的长线冒险。",
  },
  {
    value: "suspense",
    label: "悬疑推理",
    description: "以谜题、调查、反转和心理博弈为核心。",
  },
  {
    value: "historical-alternate",
    label: "架空历史",
    description: "在类历史世界里展开权谋、战争或制度变革。",
  },
];

export const backgrounds: PlotFilterOption[] = [
  {
    value: "modern-megacity",
    label: "现代巨城",
    description: "高密度城市、公司、地下势力和普通生活交错。",
  },
  {
    value: "frontier-colony",
    label: "边境殖民地",
    description: "资源稀缺、秩序薄弱，人人都在争夺生存空间。",
  },
  {
    value: "fallen-dynasty",
    label: "王朝末年",
    description: "旧秩序衰败，新势力正在争夺合法性。",
  },
  {
    value: "academy",
    label: "学院体系",
    description: "训练、考试、派系和竞赛推动角色成长。",
  },
  {
    value: "post-catastrophe",
    label: "灾后世界",
    description: "文明受损，幸存者在废墟中重建规则。",
  },
];

export const worldSettings: PlotFilterOption[] = [
  {
    value: "hidden-power-system",
    label: "隐藏力量体系",
    description: "普通世界背后存在不公开的能力和组织规则。",
  },
  {
    value: "ranked-realms",
    label: "等级境界",
    description: "清晰的实力层级、晋升门槛和资源争夺。",
  },
  {
    value: "contract-magic",
    label: "契约法则",
    description: "力量来自契约、交换、承诺或代价。",
  },
  {
    value: "ai-governed",
    label: "AI 治理社会",
    description: "算法参与分配资源、评价人类和维持秩序。",
  },
  {
    value: "myth-reawakened",
    label: "神话复苏",
    description: "古老传说以现代或架空形式重新影响世界。",
  },
];

export const protagonists: PlotFilterOption[] = [
  {
    value: "failed-genius",
    label: "失意天才",
    description: "曾经被看好，如今必须从低谷重新证明自己。",
  },
  {
    value: "ordinary-witness",
    label: "普通目击者",
    description: "原本无关的人被卷入关键事件。",
  },
  {
    value: "exiled-heir",
    label: "流放继承人",
    description: "身份特殊却失去资源，需要夺回选择权。",
  },
  {
    value: "professional-fixer",
    label: "问题处理人",
    description: "擅长解决麻烦，但这次遇到超出经验的局。",
  },
  {
    value: "reluctant-leader",
    label: "被迫领袖",
    description: "不想掌权，却被局势推到众人前面。",
  },
];

export const coreConflicts: PlotFilterOption[] = [
  {
    value: "individual-vs-system",
    label: "个人对抗系统",
    description: "主角必须挑战看似无法撼动的规则。",
  },
  {
    value: "secret-vs-loyalty",
    label: "秘密与忠诚",
    description: "真相会伤害主角最需要守护的人。",
  },
  {
    value: "survival-vs-humanity",
    label: "生存与人性",
    description: "活下去的选择不断逼近道德底线。",
  },
  {
    value: "destiny-vs-choice",
    label: "命运与选择",
    description: "预言、血脉或制度安排与个人意志冲突。",
  },
  {
    value: "power-vs-corruption",
    label: "权力与腐化",
    description: "越接近胜利，主角越容易变成自己厌恶的人。",
  },
];

export const tones: PlotFilterOption[] = [
  {
    value: "tense",
    label: "紧张压迫",
    description: "节奏快、危机密集，读者持续感到压力。",
  },
  {
    value: "warm-blooded",
    label: "热血成长",
    description: "重视目标感、伙伴关系和阶段性胜利。",
  },
  {
    value: "dark-realistic",
    label: "冷峻现实",
    description: "规则残酷，代价清晰，胜利不轻松。",
  },
  {
    value: "mysterious",
    label: "悬疑诡秘",
    description: "信息逐步揭露，氛围带有未知和不安。",
  },
  {
    value: "light-adventure",
    label: "轻快冒险",
    description: "冲突明确，但阅读体验更轻盈、有探索感。",
  },
];

export const serialStructures: PlotFilterOption[] = [
  {
    value: "three-act-volume",
    label: "三幕式首卷",
    description: "开局事件、升级对抗、首卷高潮清晰递进。",
  },
  {
    value: "case-by-case",
    label: "单元案件",
    description: "每个单元解决一个事件，同时推进主线。",
  },
  {
    value: "quest-chain",
    label: "任务链推进",
    description: "通过连续目标、奖励和失败代价推动连载。",
  },
  {
    value: "faction-war",
    label: "势力战争",
    description: "多个阵营的目标冲突持续升级。",
  },
  {
    value: "mystery-box",
    label: "谜团递进",
    description: "每卷打开一个谜题，同时埋下更深层答案。",
  },
];

export const plotFilters = {
  themes,
  genres,
  backgrounds,
  worldSettings,
  protagonists,
  coreConflicts,
  tones,
  serialStructures,
};

export type PlotFilterKey = keyof typeof plotFilters;

export function findPlotFilterLabel(key: PlotFilterKey, value?: string | null) {
  return plotFilters[key].find((option) => option.value === value)?.label || "未选择";
}

export function isValidPlotFilterValue(key: PlotFilterKey, value: unknown) {
  return typeof value === "string" && plotFilters[key].some((option) => option.value === value);
}
