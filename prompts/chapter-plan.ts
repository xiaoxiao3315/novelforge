import type { ChapterPlanInput, ChapterWritingPlan } from "@/lib/quality/types";

export const CHAPTER_PLAN_PROMPT_VERSION = "chapter-plan-v1";

export const CHAPTER_PLAN_SYSTEM_PROMPT = [
  "你是中文长篇网文章节剧情策划 Agent。",
  "你只负责生成当前章节的写作计划，不写正文，不续写下一章。",
  "你必须保护网文节奏，优先明确冲突、行动、爽点、情绪推进和结尾钩子。",
  "你必须遵守 story_bible 的不可变设定、角色卡、前文摘要和互动状态。",
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
].join(" ");

const chapterPlanJsonExample: ChapterWritingPlan = {
  chapterGoal: "推动主角完成本章核心选择，并让读者看见他为目标付出的代价。",
  coreConflict: "主角想立刻追查线索，但同伴担心暴露身份，外部敌人也在逼近。",
  emotionalArc: "从压抑怀疑到被迫摊牌，再到带着代价获得短暂主动权。",
  keyScenes: [
    "开场用行动承接上一章选择的后果。",
    "中段用对话和阻碍升级核心冲突。",
    "结尾抛出新危险或新线索，形成追更钩子。",
  ],
  characterBeats: [
    {
      character: "主角",
      goal: "拿到关键线索并保护同伴。",
      emotionalChange: "从急躁试探变为承认代价后的坚定。",
      dialogueTone: "克制、直接，遇到压力时带一点锋利反问。",
    },
  ],
  suspenseAndHooks: ["线索指向更大的幕后人物。", "章末出现必须立刻处理的新危险。"],
  mustInclude: ["本章大纲中的事件、冲突、角色变化和伏笔。"],
  mustAvoid: ["不要长篇解释设定。", "不要把情绪写成空泛抒情。"],
  pacingPlan: ["短行动开场", "冲突升级", "信息释放", "情绪爆点", "章末钩子"],
  endingHook: "让读者明确知道下一章必须追问的危险或秘密。",
  continuityNotes: ["不得违背 story_bible immutableRules。", "必须承接前文摘要中的未解决悬念。"],
};

function formatJsonForPrompt(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildChapterPlanPrompt(input: ChapterPlanInput) {
  return [
    "请基于 story context 为当前章节生成一份章节写作计划 JSON。",
    "",
    "策划边界：",
    "- 只做当前章节策划，不写正文，不输出片段，不生成下一章。",
    "- 不改变 story_bible 的不可变设定、世界规则、角色身份、前文事实。",
    "- 必须明确本章目标、核心冲突、情绪弧、爽点、角色变化、关键场景和结尾钩子。",
    "- 必须指出本章应该避免的问题，尤其是设定漂移、角色跑偏、节奏变慢和过度文学化。",
    "- 保护网文节奏：优先行动推进、冲突升级、信息差、代价、选择和章末追问。",
    "- 如果 story context 中存在 directorInstruction，必须吸收其可用意图，但优先级低于 story_bible、characters、chapterOutline 和 previousSummaries。",
    "- 如果存在 interactiveDecision 或 interactiveState，必须体现上一章选择和当前互动状态对本章冲突、关系、情绪或路线的影响。",
    "- 不要新增无关支线，不要为了润色牺牲类型文节奏。",
    "",
    "必须严格输出如下 JSON 结构，顶层字段不可缺失：",
    formatJsonForPrompt(chapterPlanJsonExample),
    "",
    "story context：",
    formatJsonForPrompt(input.storyContext),
    "",
    "现在只输出 chapter plan JSON。",
  ].join("\n");
}
