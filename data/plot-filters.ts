export type PlotFilterOption = {
  value: string;
  label: string;
  description: string;
};

export type MarketPlotFilterOption = PlotFilterOption & {
  channels?: string[];
};

export const MARKET_FILTER_VERSION = "market-v2";

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

export const channels: PlotFilterOption[] = [
  { value: "male", label: "男频向", description: "强调升级、目标、爽点推进和长线竞争。" },
  { value: "female", label: "女频向", description: "强调关系张力、情绪回报、身份处境和成长选择。" },
  { value: "general", label: "泛读者向", description: "跨频道读者可进入，题材钩子和情绪节奏优先。" },
  { value: "no-cp", label: "无CP向", description: "不以恋爱关系为主驱动，聚焦事业、冒险或群像。" },
  { value: "danmei", label: "纯爱向", description: "以双男主关系、成长羁绊或情感拉扯为核心卖点。" },
  { value: "baihe", label: "百合向", description: "以女性角色关系、共同成长和情感张力为核心。" },
  { value: "short-drama", label: "短剧向", description: "高密度反转、强冲突、短周期爽点兑现。" },
  { value: "interactive", label: "互动剧情向", description: "适合分支选择、状态变化和章节决策的剧情结构。" },
];

export const marketGenres: MarketPlotFilterOption[] = [
  { value: "xuanhuan", label: "玄幻", description: "境界、血脉、秘境和强者体系推动成长。", channels: ["male"] },
  { value: "xianxia", label: "仙侠", description: "修行、宗门、飞升与因果劫难构成长线。", channels: ["male"] },
  { value: "urban", label: "都市", description: "现代生活场景里的逆袭、异能、商战或情感矛盾。", channels: ["male"] },
  { value: "historical", label: "历史", description: "朝堂、战争、制度变革和时代博弈。", channels: ["male"] },
  { value: "sci-fi", label: "科幻", description: "未来科技、星际秩序、AI 或文明危机。", channels: ["male"] },
  { value: "suspense", label: "悬疑", description: "案件、谜团、反转和心理博弈驱动阅读。", channels: ["male"] },
  { value: "game-esports", label: "游戏竞技", description: "游戏机制、赛事目标和团队对抗。", channels: ["male"] },
  { value: "multiverse", label: "诸天无限", description: "副本、世界穿梭、任务链和资源成长。", channels: ["male"] },
  { value: "fantasy", label: "奇幻", description: "异世界种族、魔法体系和冒险史诗。", channels: ["male"] },
  { value: "wuxia", label: "武侠", description: "江湖秩序、门派恩怨、侠义选择和武学成长。", channels: ["male"] },
  { value: "realistic", label: "现实题材", description: "现实行业、社会处境和人物奋斗。", channels: ["male"] },
  { value: "light-novel", label: "轻小说", description: "轻快设定、角色互动和强概念卖点。", channels: ["male"] },
  { value: "modern-romance", label: "现代言情", description: "当代关系、事业处境和情绪拉扯。", channels: ["female"] },
  { value: "ancient-romance", label: "古代言情", description: "古代身份、家族、权谋与情感选择。", channels: ["female"] },
  { value: "rebirth-transmigration", label: "穿越重生", description: "带着记忆或现代视角重开人生。", channels: ["female"] },
  { value: "quick-transmigration-system", label: "快穿系统", description: "多世界任务、系统目标与情感/成长回报。", channels: ["female"] },
  { value: "ceo-romance", label: "豪门总裁", description: "阶层差、契约关系、家族压力和情绪爽点。", channels: ["female"] },
  { value: "campus", label: "青春校园", description: "校园成长、暗恋、竞赛与青春选择。", channels: ["female"] },
  { value: "entertainment", label: "娱乐圈", description: "演艺事业、舆论危机、营业关系和逆袭。", channels: ["female"] },
  { value: "palace-house", label: "宫斗宅斗", description: "内宅、后宫、家族权力和身份博弈。", channels: ["female"] },
  { value: "farming-business", label: "种田经商", description: "经营积累、生活改善和稳定成就感。", channels: ["female"] },
  { value: "fantasy-romance", label: "幻想言情", description: "异能、仙侠、玄幻或奇幻框架下的情感线。", channels: ["female"] },
  { value: "romantic-suspense", label: "悬疑恋爱", description: "案件和关系同步推进，危险中建立信任。", channels: ["female"] },
  { value: "period-drama", label: "年代文", description: "特定年代生活、家庭选择、事业与情感成长。", channels: ["female"] },
  { value: "rule-horror", label: "规则怪谈", description: "异常规则、禁忌试探和生存推理。", channels: ["general"] },
  { value: "infinite-flow", label: "无限流", description: "副本挑战、队伍协作、谜题和成长收益。", channels: ["general"] },
  { value: "apocalypse", label: "末日生存", description: "资源压力、秩序崩塌和团队求生。", channels: ["general"] },
  { value: "detective", label: "悬疑推理", description: "线索、误导、真相揭露和人物动机。", channels: ["general"] },
  { value: "urban-brainstorm", label: "都市脑洞", description: "高概念设定落入日常城市生活。", channels: ["general"] },
  { value: "cyber-future", label: "赛博未来", description: "技术控制、身份困境和未来社会冲突。", channels: ["general"] },
  { value: "healing-fantasy", label: "治愈幻想", description: "温柔奇遇、修复关系和情绪疗愈。", channels: ["general"] },
  { value: "ensemble-suspense", label: "群像悬疑", description: "多人物视角拼合真相和利益冲突。", channels: ["general"] },
  { value: "supernatural", label: "灵异怪谈", description: "民俗、灵异事件、禁忌和未知恐惧。", channels: ["general"] },
  { value: "light-comedy", label: "轻喜剧", description: "轻松误会、反差角色和连续笑点。", channels: ["general"] },
  { value: "no-cp-adventure", label: "无CP冒险", description: "目标、探索和伙伴协作压过恋爱线。", channels: ["no-cp"] },
  { value: "career-growth", label: "事业成长", description: "职业目标、行业挑战和能力兑现。", channels: ["no-cp"] },
  { value: "bromance-growth", label: "纯爱成长", description: "关系推进与个人成长并行。", channels: ["danmei"] },
  { value: "danmei-suspense", label: "纯爱悬疑", description: "案件危机和双主角信任建立同步推进。", channels: ["danmei"] },
  { value: "baihe-growth", label: "百合成长", description: "女性主角关系与共同目标互相托举。", channels: ["baihe"] },
  { value: "baihe-fantasy", label: "百合幻想", description: "幻想设定中的关系张力、共同冒险和成长。", channels: ["baihe"] },
  { value: "short-drama-reversal", label: "短剧反转", description: "短段落强冲突、强误会、强反杀。", channels: ["short-drama"] },
  { value: "short-drama-romance", label: "短剧情感", description: "情绪爆点、身份错位和快速关系转折。", channels: ["short-drama"] },
  { value: "branching-adventure", label: "分支冒险", description: "选择影响路线、资源和角色关系。", channels: ["interactive"] },
  { value: "interactive-romance", label: "互动恋爱", description: "选择影响好感、误会、承诺和结局方向。", channels: ["interactive"] },
];

export const subGenresByMarketGenre: Record<string, PlotFilterOption[]> = {
  xuanhuan: [
    { value: "xuanhuan-upgrade", label: "升级流", description: "明确境界、资源竞争和阶段性胜利。" },
    { value: "xuanhuan-waste-to-strong", label: "废柴逆袭", description: "低谷起步，通过奇遇或坚持反超。" },
    { value: "xuanhuan-sect", label: "宗门争霸", description: "门派资源、试炼、长老和同辈竞争。" },
  ],
  xianxia: [
    { value: "xianxia-cultivation", label: "修真升级", description: "功法、灵根、渡劫和飞升目标。" },
    { value: "xianxia-mortal", label: "凡人修仙", description: "低资质谨慎成长，资源与风险并重。" },
    { value: "xianxia-sect-politics", label: "仙门权谋", description: "宗门秩序、因果债和阵营博弈。" },
  ],
  urban: [
    { value: "urban-superpower", label: "都市异能", description: "现实都市中觉醒能力并解决危机。" },
    { value: "urban-business", label: "商战逆袭", description: "资源整合、商业竞争和阶层跃迁。" },
    { value: "urban-doctor", label: "神医高手", description: "医术、疑难事件和人脉积累。" },
  ],
  historical: [
    { value: "historical-court", label: "朝堂权谋", description: "官场、派系、皇权和制度选择。" },
    { value: "historical-war", label: "乱世争霸", description: "军政、战略、民生和势力扩张。" },
    { value: "historical-farming", label: "历史经营", description: "从地方建设走向更大格局。" },
  ],
  "sci-fi": [
    { value: "sci-fi-star", label: "星际文明", description: "星际秩序、舰队、资源和文明碰撞。" },
    { value: "sci-fi-ai", label: "AI危机", description: "算法治理、自主意识和身份边界。" },
    { value: "sci-fi-mecha", label: "机甲战斗", description: "驾驶、战术、团队和战争压力。" },
  ],
  suspense: [
    { value: "suspense-case", label: "单元案件", description: "一案一推进，同时铺设主线谜团。" },
    { value: "suspense-psychological", label: "心理悬疑", description: "不可靠信息、动机反转和心理压迫。" },
    { value: "suspense-crime", label: "刑侦追凶", description: "证据链、嫌疑人和真凶博弈。" },
  ],
  "game-esports": [
    { value: "game-esports-pro", label: "职业赛场", description: "赛事晋级、队伍磨合和战术兑现。" },
    { value: "game-esports-online", label: "网游升级", description: "副本、装备、帮会和服务器竞争。" },
    { value: "game-esports-management", label: "战队经营", description: "选手培养、资源配置和舆论压力。" },
  ],
  multiverse: [
    { value: "multiverse-dungeon", label: "副本闯关", description: "规则、任务和奖励构成连续推进。" },
    { value: "multiverse-world-hopping", label: "诸天穿梭", description: "不同世界获取能力与情报。" },
    { value: "multiverse-survival", label: "无限求生", description: "高压环境下的团队和背叛。" },
  ],
  fantasy: [
    { value: "fantasy-epic", label: "史诗冒险", description: "王国、种族、使命和远征。" },
    { value: "fantasy-magic-academy", label: "魔法学院", description: "学习、考核、社团和隐藏危机。" },
    { value: "fantasy-lord", label: "领地经营", description: "建设、外交、防御和扩张。" },
  ],
  wuxia: [
    { value: "wuxia-jianghu", label: "江湖恩怨", description: "门派、仇怨、侠义和名声。" },
    { value: "wuxia-martial-growth", label: "武道成长", description: "秘籍、师承、擂台和境界突破。" },
    { value: "wuxia-detective", label: "武侠探案", description: "江湖案件与门派利益交织。" },
  ],
  realistic: [
    { value: "realistic-industry", label: "行业奋斗", description: "专业能力、组织压力和现实选择。" },
    { value: "realistic-family", label: "家庭群像", description: "亲密关系、代际矛盾和生活修复。" },
    { value: "realistic-startup", label: "创业成长", description: "产品、团队、资金和市场压力。" },
  ],
  "light-novel": [
    { value: "light-novel-academy", label: "学院日常", description: "轻快角色互动与阶段目标。" },
    { value: "light-novel-isekai", label: "异世界轻冒险", description: "穿越设定、队伍和任务链。" },
    { value: "light-novel-comedy", label: "反差喜剧", description: "设定反差、吐槽节奏和角色化卖点。" },
  ],
  "modern-romance": [
    { value: "modern-romance-workplace", label: "职场恋爱", description: "事业目标和关系推进互相牵制。" },
    { value: "modern-romance-reunion", label: "破镜重圆", description: "旧伤、误会、成长后再选择。" },
    { value: "modern-romance-marriage", label: "先婚后爱", description: "契约关系中逐步建立信任。" },
  ],
  "ancient-romance": [
    { value: "ancient-romance-court", label: "权谋言情", description: "身份、朝局和情感选择互相拉扯。" },
    { value: "ancient-romance-family", label: "家宅成长", description: "家族秩序、婚嫁压力和自我掌控。" },
    { value: "ancient-romance-general", label: "将门情缘", description: "战事、家国和双强关系。" },
  ],
  "rebirth-transmigration": [
    { value: "rebirth-revenge", label: "重生复仇", description: "带着记忆弥补遗憾、反制旧敌。" },
    { value: "transmigration-survival", label: "穿越求生", description: "陌生时代或世界中的身份适应。" },
    { value: "transmigration-farming", label: "穿越种田", description: "经营生活、改善处境和稳定积累。" },
  ],
  "quick-transmigration-system": [
    { value: "quick-system-task", label: "任务攻略", description: "世界任务、评分和关系目标。" },
    { value: "quick-system-slapback", label: "虐渣打脸", description: "短周期强反制和情绪释放。" },
    { value: "quick-system-redemption", label: "救赎单元", description: "每个世界修复角色命运。" },
  ],
  "ceo-romance": [
    { value: "ceo-contract", label: "契约婚恋", description: "利益交换下的误会和真心。" },
    { value: "ceo-hidden-identity", label: "隐婚马甲", description: "身份隐藏、舆论危机和关系反转。" },
    { value: "ceo-family", label: "豪门家族", description: "继承、联姻、家族阻力和情感选择。" },
  ],
  campus: [
    { value: "campus-first-love", label: "青春暗恋", description: "克制心动、误会和成长告白。" },
    { value: "campus-competition", label: "竞赛成长", description: "考试、竞赛、社团和目标达成。" },
    { value: "campus-healing", label: "校园治愈", description: "友情、家庭阴影和自我接纳。" },
  ],
  entertainment: [
    { value: "entertainment-comeback", label: "逆袭翻红", description: "作品、舆论和资源争夺。" },
    { value: "entertainment-variety", label: "综艺爆红", description: "节目任务、人设反差和社交修罗场。" },
    { value: "entertainment-fake-couple", label: "营业CP", description: "合作营业到真实情感的推进。" },
  ],
  "palace-house": [
    { value: "palace-harem", label: "后宫博弈", description: "位分、宠爱、规则和生存智慧。" },
    { value: "house-family", label: "宅斗成长", description: "家族资源、婚嫁和内宅权力。" },
    { value: "palace-revenge", label: "宫廷复仇", description: "旧怨、隐忍和身份翻盘。" },
  ],
  "farming-business": [
    { value: "farming-food", label: "美食经营", description: "技能、店铺、口碑和生活烟火。" },
    { value: "farming-village", label: "乡村种田", description: "土地、邻里、家庭和稳步改善。" },
    { value: "business-ancient", label: "古代经商", description: "铺面、商路、账本和人脉经营。" },
  ],
  "fantasy-romance": [
    { value: "fantasy-romance-xianxia", label: "仙侠情缘", description: "修行使命、因果和情感抉择。" },
    { value: "fantasy-romance-beast", label: "兽世幻想", description: "族群规则、生存和关系建立。" },
    { value: "fantasy-romance-superpower", label: "异能恋爱", description: "能力代价、危机合作和情感升温。" },
  ],
  "romantic-suspense": [
    { value: "romantic-suspense-case", label: "破案恋爱", description: "案件推进和关系信任同步增长。" },
    { value: "romantic-suspense-danger", label: "危险关系", description: "身份疑云、互相试探和情绪张力。" },
    { value: "romantic-suspense-secret", label: "秘密追踪", description: "旧案、隐瞒和共同面对真相。" },
  ],
  "period-drama": [
    { value: "period-family", label: "年代家庭", description: "家人关系、时代选择和生活改善。" },
    { value: "period-career", label: "年代事业", description: "岗位、学习、政策变化和奋斗回报。" },
    { value: "period-romance", label: "年代情感", description: "克制表达、现实阻力和共同成长。" },
  ],
  "rule-horror": [
    { value: "rule-horror-school", label: "校园规则", description: "熟悉场景中的异常规则和禁忌。" },
    { value: "rule-horror-community", label: "社区怪谈", description: "邻里、楼栋、群体规则和真相。" },
    { value: "rule-horror-workplace", label: "职场规则", description: "工作流程变成生存试炼。" },
  ],
  "infinite-flow": [
    { value: "infinite-flow-team", label: "团队闯关", description: "分工协作、信任危机和副本谜题。" },
    { value: "infinite-flow-solo", label: "单人高智", description: "主角用观察和策略破解规则。" },
    { value: "infinite-flow-emotional", label: "情感副本", description: "每个副本都绑定角色创伤或关系。" },
  ],
  apocalypse: [
    { value: "apocalypse-zombie", label: "丧尸末日", description: "感染、避难、资源和人性考验。" },
    { value: "apocalypse-natural", label: "天灾囤货", description: "灾变阶段、物资规划和家庭求生。" },
    { value: "apocalypse-base", label: "基地建设", description: "团队扩张、秩序建立和外部威胁。" },
  ],
  detective: [
    { value: "detective-classic", label: "本格推理", description: "公平线索、诡计和逻辑还原。" },
    { value: "detective-social", label: "社会派推理", description: "案件背后的人性与现实结构。" },
    { value: "detective-cozy", label: "轻悬疑", description: "低压谜题、生活氛围和角色互动。" },
  ],
  "urban-brainstorm": [
    { value: "urban-brainstorm-app", label: "神秘APP", description: "日常中出现任务、评分或异常入口。" },
    { value: "urban-brainstorm-luck", label: "人生模拟", description: "模拟、预知、选择和现实改变。" },
    { value: "urban-brainstorm-identity", label: "身份反转", description: "隐藏身份或新规则改变日常秩序。" },
  ],
  "cyber-future": [
    { value: "cyber-future-hacker", label: "黑客潜入", description: "数据、权限、追踪和技术对抗。" },
    { value: "cyber-future-city", label: "赛博都市", description: "阶层、义体、公司和地下秩序。" },
    { value: "cyber-future-ai", label: "算法命运", description: "预测系统、自由意志和身份边界。" },
  ],
  "healing-fantasy": [
    { value: "healing-fantasy-shop", label: "治愈小店", description: "客人故事、温柔解决和持续羁绊。" },
    { value: "healing-fantasy-travel", label: "幻想旅途", description: "慢节奏探索、风物和情绪修复。" },
    { value: "healing-fantasy-companion", label: "陪伴成长", description: "角色互相治愈并完成小目标。" },
  ],
  "ensemble-suspense": [
    { value: "ensemble-suspense-town", label: "小镇群像", description: "每个人都有秘密，真相层层拼合。" },
    { value: "ensemble-suspense-family", label: "家族谜案", description: "亲缘、遗产、旧案和共同隐瞒。" },
    { value: "ensemble-suspense-closed", label: "封闭空间", description: "有限场景里多人动机互相碰撞。" },
  ],
  supernatural: [
    { value: "supernatural-folk", label: "民俗怪谈", description: "地方禁忌、仪式和传说背后的真相。" },
    { value: "supernatural-urban", label: "都市灵异", description: "城市日常中不断扩散的异常事件。" },
    { value: "supernatural-investigation", label: "灵异调查", description: "调查团队、线索和规则边界。" },
  ],
  "light-comedy": [
    { value: "light-comedy-daily", label: "日常轻喜", description: "连续误会、角色反差和温暖收束。" },
    { value: "light-comedy-career", label: "职场喜剧", description: "工作目标、团队吐槽和反差成长。" },
    { value: "light-comedy-family", label: "家庭喜剧", description: "家庭关系、生活麻烦和轻松解决。" },
  ],
  "no-cp-adventure": [
    { value: "no-cp-adventure-survival", label: "生存冒险", description: "目标和危机推动，不以恋爱兑现。" },
    { value: "no-cp-adventure-team", label: "伙伴群像", description: "团队目标、友情和共同成长。" },
    { value: "no-cp-adventure-mystery", label: "解谜探索", description: "线索、地图、机关和真相推进。" },
  ],
  "career-growth": [
    { value: "career-growth-industry", label: "行业升级", description: "技能树、项目、资源和专业成长。" },
    { value: "career-growth-competition", label: "竞赛晋级", description: "明确赛程和阶段胜利。" },
    { value: "career-growth-management", label: "组织经营", description: "带队、管理和长期目标。" },
  ],
  "bromance-growth": [
    { value: "bromance-growth-slowburn", label: "慢热羁绊", description: "从试探到信任，情绪逐层递进。" },
    { value: "bromance-growth-rival", label: "宿敌并肩", description: "竞争关系转为共同选择。" },
    { value: "bromance-growth-healing", label: "互相救赎", description: "彼此理解创伤并改变命运。" },
  ],
  "danmei-suspense": [
    { value: "danmei-suspense-case", label: "搭档破案", description: "案件合作推动信任与心动。" },
    { value: "danmei-suspense-danger", label: "危险搭档", description: "身份秘密与感情试探并存。" },
    { value: "danmei-suspense-past", label: "旧案重逢", description: "过去真相牵引关系修复。" },
  ],
  "baihe-growth": [
    { value: "baihe-growth-slowburn", label: "慢热同行", description: "共同目标里逐步确认彼此。" },
    { value: "baihe-growth-career", label: "事业双强", description: "职业成长和关系支持并行。" },
    { value: "baihe-growth-healing", label: "温柔救赎", description: "以陪伴、理解和选择推动关系。" },
  ],
  "baihe-fantasy": [
    { value: "baihe-fantasy-adventure", label: "幻想冒险", description: "共同探索、危机互救和情感升温。" },
    { value: "baihe-fantasy-xianxia", label: "仙侠百合", description: "修行、因果和双女主关系张力。" },
    { value: "baihe-fantasy-superpower", label: "异能搭档", description: "能力互补、任务合作和身份秘密。" },
  ],
  "short-drama-reversal": [
    { value: "short-drama-reversal-revenge", label: "复仇反杀", description: "强压迫后快速反制。" },
    { value: "short-drama-reversal-identity", label: "身份打脸", description: "隐藏身份带来高密度反转。" },
    { value: "short-drama-reversal-family", label: "家庭冲突", description: "亲缘误会、偏爱和情绪爆点。" },
  ],
  "short-drama-romance": [
    { value: "short-drama-romance-contract", label: "契约速燃", description: "关系误会和情绪转折快速推进。" },
    { value: "short-drama-romance-reunion", label: "重逢拉扯", description: "旧情、误会和强情绪对峙。" },
    { value: "short-drama-romance-hidden", label: "隐婚掉马", description: "身份揭露和关系爆点密集兑现。" },
  ],
  "branching-adventure": [
    { value: "branching-adventure-survival", label: "生存选择", description: "选择影响资源、队友和路线风险。" },
    { value: "branching-adventure-mystery", label: "解谜分支", description: "不同线索导向不同真相路径。" },
    { value: "branching-adventure-faction", label: "阵营路线", description: "选择阵营改变任务、敌友和结局。" },
  ],
  "interactive-romance": [
    { value: "interactive-romance-affection", label: "好感路线", description: "选择影响关系亲密度和误会解除。" },
    { value: "interactive-romance-triangle", label: "多线情感", description: "多角色路线和情感抉择。" },
    { value: "interactive-romance-ending", label: "多结局恋爱", description: "关键选择决定关系归宿。" },
  ],
};

export const tropes: PlotFilterOption[] = [
  { value: "comeback", label: "逆袭翻盘", description: "从被低估到拿回主动权。" },
  { value: "face-slap", label: "打脸反杀", description: "压迫和质疑后快速兑现反制爽点。" },
  { value: "hidden-identity", label: "隐藏身份", description: "真实身份或能力逐步揭露。" },
  { value: "revenge", label: "复仇清算", description: "旧伤、旧敌和计划性反击。" },
  { value: "survival-pressure", label: "极限生存", description: "资源、规则或敌人持续制造压力。" },
  { value: "team-growth", label: "团队成长", description: "伙伴分工、信任建立和共同胜利。" },
  { value: "power-up", label: "升级变强", description: "能力体系和阶段突破带来追更感。" },
  { value: "mystery-box", label: "谜团递进", description: "每次揭露都打开更大的问题。" },
  { value: "business-building", label: "经营建设", description: "资源积累、口碑扩张和稳定成就感。" },
  { value: "contract-relationship", label: "契约关系", description: "利益交换下逐步产生真实情感或信任。" },
  { value: "slow-burn", label: "慢热拉扯", description: "克制互动、误会和渐进确认。" },
  { value: "multiple-endings", label: "多结局路线", description: "关键选择影响人物关系和最终走向。" },
];

export const protagonistArchetypes: PlotFilterOption[] = [
  { value: "underdog", label: "低谷逆袭型", description: "起点受限，但目标清晰、成长可见。" },
  { value: "cool-strategist", label: "冷静谋略型", description: "靠观察、布局和信息差取胜。" },
  { value: "hot-blooded", label: "热血行动型", description: "主动出击，靠行动推动局面。" },
  { value: "hidden-boss", label: "隐藏大佬型", description: "表面普通，真实能力或身份逐步曝光。" },
  { value: "professional", label: "专业强人型", description: "拥有明确职业能力和解决问题的手段。" },
  { value: "healing-lead", label: "治愈陪伴型", description: "通过理解、陪伴和稳定选择改变关系。" },
  { value: "double-strong", label: "双强主角型", description: "主角与关键对象势均力敌，互相试探合作。" },
  { value: "antihero", label: "灰度反英雄型", description: "目标明确，手段有争议，代价清晰。" },
];

export const cheatPowers: PlotFilterOption[] = [
  { value: "system", label: "系统任务", description: "任务、奖励、评分或进度条提供外部驱动。" },
  { value: "rebirth-memory", label: "重生记忆", description: "提前知道关键节点，但仍需承担蝴蝶效应。" },
  { value: "space-storage", label: "随身空间", description: "资源储备、经营建设或生存优势。" },
  { value: "special-ability", label: "特殊异能", description: "能力强但有边界和使用代价。" },
  { value: "golden-finger-item", label: "关键神器", description: "道具、秘籍、遗物或技术装置提供突破口。" },
  { value: "information-gap", label: "信息差", description: "情报、专业知识或未来趋势形成优势。" },
  { value: "team-bond", label: "羁绊加成", description: "关系、队伍或契约带来能力变化。" },
  { value: "none", label: "无显性金手指", description: "靠选择、专业能力和人物关系推动成长。" },
];

export const romanceLines: PlotFilterOption[] = [
  { value: "none", label: "无情感线", description: "不以恋爱关系作为主要卖点。" },
  { value: "light", label: "轻情感线", description: "关系作为辅助情绪回报，不压过主线。" },
  { value: "slow-burn", label: "慢热拉扯", description: "误会、试探和信任逐步推进。" },
  { value: "strong", label: "强情感线", description: "情感选择深度影响主线行动。" },
  { value: "double-lead", label: "双主关系", description: "双主角关系与剧情目标同等重要。" },
  { value: "multi-route", label: "多线关系", description: "多角色关系或路线选择形成分支。" },
];

export const marketTones: PlotFilterOption[] = [
  { value: "fast-refresh", label: "快节奏爽文", description: "冲突密集、兑现快、章节钩子强。" },
  { value: "steady-upgrade", label: "稳步升级", description: "阶段目标清楚，成长和奖励节奏稳定。" },
  { value: "high-pressure", label: "高压悬念", description: "危机不断，信息差和未知感持续存在。" },
  { value: "emotional", label: "情绪拉扯", description: "关系、误会和选择制造情绪张力。" },
  { value: "light-comedic", label: "轻松喜剧", description: "阅读压力低，靠反差和趣味互动推进。" },
  { value: "healing", label: "治愈慢热", description: "节奏柔和，重视修复、陪伴和生活感。" },
  { value: "dark", label: "冷峻黑暗", description: "代价清晰、规则残酷、胜利不轻松。" },
  { value: "short-drama-fast", label: "短剧爆点", description: "短段落强反转，冲突和情绪迅速升级。" },
];

export const marketFilters = {
  channels,
  marketGenres,
  tropes,
  protagonistArchetypes,
  cheatPowers,
  romanceLines,
  tones: marketTones,
};

export type MarketFilterKey = keyof typeof marketFilters;

export type StoryConfigRowForPrompt = {
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

export type StoryConfigPromptData = {
  theme: string;
  genre: string;
  background: string;
  worldSetting: string;
  protagonist: string;
  coreConflict: string;
  tone: string;
  serialStructure: string;
  extraIdeas: string | null;
  filterVersion?: typeof MARKET_FILTER_VERSION;
  channel?: string;
  marketGenre?: string;
  subGenre?: string;
  tropes?: string[];
  protagonistArchetype?: string;
  cheatPower?: string;
  romanceLine?: string;
};

export type ConfigDisplayItem = {
  label: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(cleanString).filter(Boolean);
}

export function getMarketGenresForChannel(channel: string) {
  return marketGenres.filter((option) => option.channels?.includes(channel));
}

export function getSubGenresForMarketGenre(marketGenre: string) {
  return subGenresByMarketGenre[marketGenre] ?? [];
}

function findSubGenreLabel(value?: string | null) {
  for (const options of Object.values(subGenresByMarketGenre)) {
    const label = options.find((option) => option.value === value)?.label;

    if (label) {
      return label;
    }
  }

  return "未选择";
}

export function findMarketFilterLabel(key: MarketFilterKey | "subGenres", value?: string | null) {
  if (key === "subGenres") {
    return findSubGenreLabel(value);
  }

  return marketFilters[key].find((option) => option.value === value)?.label || "未选择";
}

export function isValidMarketFilterValue(key: MarketFilterKey, value: unknown) {
  return typeof value === "string" && marketFilters[key].some((option) => option.value === value);
}

export function isValidSubGenreForMarketGenre(marketGenre: unknown, subGenre: unknown) {
  return (
    typeof marketGenre === "string" &&
    typeof subGenre === "string" &&
    getSubGenresForMarketGenre(marketGenre).some((option) => option.value === subGenre)
  );
}

export function isValidMarketGenreForChannel(channel: unknown, marketGenre: unknown) {
  return (
    typeof channel === "string" &&
    typeof marketGenre === "string" &&
    getMarketGenresForChannel(channel).some((option) => option.value === marketGenre)
  );
}

export function isMarketV2Config(
  configJson: unknown,
): configJson is Record<string, unknown> & { filterVersion: typeof MARKET_FILTER_VERSION } {
  return isRecord(configJson) && configJson.filterVersion === MARKET_FILTER_VERSION;
}

function buildMarketTropeLabels(values: string[]) {
  return values
    .map((value) => findMarketFilterLabel("tropes", value))
    .filter((label) => label !== "未选择");
}

export function buildStoryConfigPromptData(config: StoryConfigRowForPrompt): StoryConfigPromptData {
  if (isMarketV2Config(config.config_json)) {
    const marketConfig = config.config_json;
    const tropeValues = cleanStringArray(marketConfig.tropes).slice(0, 3);
    const tropeLabels = buildMarketTropeLabels(tropeValues);
    const channel = findMarketFilterLabel("channels", cleanString(marketConfig.channel));
    const marketGenre = findMarketFilterLabel("marketGenres", cleanString(marketConfig.marketGenre));
    const subGenre = findMarketFilterLabel("subGenres", cleanString(marketConfig.subGenre));
    const protagonistArchetype = findMarketFilterLabel(
      "protagonistArchetypes",
      cleanString(marketConfig.protagonistArchetype),
    );
    const cheatPower = findMarketFilterLabel("cheatPowers", cleanString(marketConfig.cheatPower));
    const romanceLine = findMarketFilterLabel(
      "romanceLines",
      cleanString(marketConfig.romanceLine),
    );
    const tone = findMarketFilterLabel("tones", cleanString(marketConfig.tone));
    const extraIdeas = cleanString(marketConfig.extraIdeas) || config.extra_ideas;

    return {
      theme: channel,
      genre: [marketGenre, subGenre].filter((item) => item !== "未选择").join(" / ") || "未选择",
      background: subGenre,
      worldSetting: cheatPower,
      protagonist: protagonistArchetype,
      coreConflict: tropeLabels.join("、") || "未选择",
      tone,
      serialStructure: romanceLine,
      extraIdeas,
      filterVersion: MARKET_FILTER_VERSION,
      channel,
      marketGenre,
      subGenre,
      tropes: tropeLabels,
      protagonistArchetype,
      cheatPower,
      romanceLine,
    };
  }

  return {
    theme: findPlotFilterLabel("themes", config.theme),
    genre: findPlotFilterLabel("genres", config.genre),
    background: findPlotFilterLabel("backgrounds", config.background),
    worldSetting: findPlotFilterLabel("worldSettings", config.world_setting),
    protagonist: findPlotFilterLabel("protagonists", config.protagonist),
    coreConflict: findPlotFilterLabel("coreConflicts", config.core_conflict),
    tone: findPlotFilterLabel("tones", config.tone),
    serialStructure: findPlotFilterLabel("serialStructures", config.serial_structure),
    extraIdeas: config.extra_ideas,
  };
}

export function buildStoryConfigPromptLines(config: StoryConfigPromptData) {
  if (config.filterVersion === MARKET_FILTER_VERSION) {
    return [
      `- 筛选器版本：${MARKET_FILTER_VERSION}`,
      `- 读者频道：${config.channel || "未选择"}`,
      `- 市场大类：${config.marketGenre || "未选择"}`,
      `- 细分赛道：${config.subGenre || "未选择"}`,
      `- 热门元素：${config.tropes?.length ? config.tropes.join("、") : "未选择"}`,
      `- 主角人设：${config.protagonistArchetype || "未选择"}`,
      `- 金手指：${config.cheatPower || "未选择"}`,
      `- 情感线：${config.romanceLine || "未选择"}`,
      `- 节奏基调：${config.tone}`,
      `- 补充想法：${config.extraIdeas || "未填写"}`,
    ];
  }

  return [
    `- 主题：${config.theme}`,
    `- 类型：${config.genre}`,
    `- 背景：${config.background}`,
    `- 世界设定：${config.worldSetting}`,
    `- 主角方向：${config.protagonist}`,
    `- 核心冲突：${config.coreConflict}`,
    `- 基调：${config.tone}`,
    `- 连载结构：${config.serialStructure}`,
    `- 补充想法：${config.extraIdeas || "未填写"}`,
  ];
}

export function buildStoryConfigDisplayItems(
  config: StoryConfigRowForPrompt | null,
): ConfigDisplayItem[] {
  if (!config) {
    return [];
  }

  const promptData = buildStoryConfigPromptData(config);

  if (promptData.filterVersion === MARKET_FILTER_VERSION) {
    return [
      { label: "读者频道", value: promptData.channel || "未选择" },
      { label: "市场大类", value: promptData.marketGenre || "未选择" },
      { label: "细分赛道", value: promptData.subGenre || "未选择" },
      {
        label: "热门元素",
        value: promptData.tropes?.length ? promptData.tropes.join("、") : "未选择",
      },
      { label: "主角人设", value: promptData.protagonistArchetype || "未选择" },
      { label: "金手指", value: promptData.cheatPower || "未选择" },
      { label: "情感线", value: promptData.romanceLine || "未选择" },
      { label: "节奏基调", value: promptData.tone },
    ];
  }

  return [
    { label: "主题", value: promptData.theme },
    { label: "类型", value: promptData.genre },
    { label: "背景", value: promptData.background },
    { label: "世界设定", value: promptData.worldSetting },
    { label: "主角", value: promptData.protagonist },
    { label: "核心冲突", value: promptData.coreConflict },
    { label: "基调", value: promptData.tone },
    { label: "连载结构", value: promptData.serialStructure },
  ];
}
