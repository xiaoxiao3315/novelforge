import type { ChapterFastGuidance, ChapterFastGuidanceInput } from "@/lib/quality/types";

export const CHAPTER_FAST_GUIDANCE_PROMPT_VERSION = "chapter-fast-guidance-v1";

export const CHAPTER_FAST_GUIDANCE_SYSTEM_PROMPT = [
  "你是中文长篇网文章节极速精修指导 Agent。",
  "你只负责一次性生成当前章节的写作计划和角色导演指令，不写正文，不续写下一章。",
  "你必须保护网文节奏，优先明确冲突、行动、爽点、情绪推进、角色声线和章末钩子。",
  "你必须遵守 story_bible 的不可变设定、角色卡、前文摘要、互动状态和当前章节大纲。",
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
].join(" ");

const fastGuidanceJsonExample: ChapterFastGuidance = {
  plan: {
    chapterGoal: "推动主角完成本章核心行动，并让读者看见选择带来的代价。",
    coreConflict: "主角必须在继续追查线索和保护同伴之间快速做出取舍。",
    emotionalArc: "从压抑试探到被迫摊牌，再到带着代价获得短暂主动权。",
    keyScenes: [
      "开场用行动承接上一章选择的后果。",
      "中段用阻碍和对话升级核心冲突。",
      "结尾抛出新危险或新线索，形成追更钩子。",
    ],
    characterBeats: [
      {
        character: "主角",
        goal: "拿到关键线索并保护同伴。",
        emotionalChange: "从急躁试探变为承认代价后的坚定。",
        dialogueTone: "克制、直接，压力越高越少解释。",
      },
    ],
    suspenseAndHooks: ["线索指向更大的幕后人物。", "章末出现必须立刻处理的新危险。"],
    mustInclude: ["当前章节大纲中的事件、冲突、角色变化和伏笔。"],
    mustAvoid: ["不要长篇解释设定。", "不要把情绪写成空泛抒情。"],
    pacingPlan: ["短行动开场", "冲突升级", "信息释放", "情绪爆点", "章末钩子"],
    endingHook: "让读者明确知道下一章必须追问的危险或秘密。",
    continuityNotes: ["不得违背 story_bible immutableRules。", "必须承接前文未解决悬念。"],
  },
  characterDirection: {
    povGuidance: "本章视角贴近主角的行动判断，让读者通过观察、隐瞒和选择感受压力。",
    focusCharacters: [
      {
        character: "主角",
        activeDesire: "想拿到关键线索，同时避免同伴暴露弱点。",
        emotionalMask: "表面冷静，内里焦虑且不愿承认自己在乎。",
        dialogueVoice: "克制、直接，多用短句和反问。",
        actionPattern: "遇到阻碍先行动试探，再用对白逼问。",
        relationshipPressure: "既需要同伴信任，又害怕把同伴拖进更危险的局面。",
        mustNotDo: ["不要突然变成旁观者。", "不要用温柔独白替代行动。"],
      },
    ],
    relationshipBeats: ["关系压力要通过误解、隐瞒、试探或共同代价呈现。"],
    dialogueRules: ["不要长篇解释世界观。", "每次让步前必须暴露一点真实目标或关系压力。"],
    actionRules: ["每个关键场景至少让一名角色带着明确欲望进入，并在结束时发生筹码变化。"],
    hiddenInformation: ["角色知道但暂时不能说出口的信息，要通过回避、改口或动作破绽暗示。"],
    continuityGuards: ["不得违背前文既成事实。", "不得覆盖 chapter plan 的核心冲突和结尾钩子。"],
    mustInclude: ["至少一次让角色用行动承担关系代价。"],
    mustAvoid: ["不要新增无关角色线。", "不要让所有角色说同一种话。"],
  },
};

function formatJsonForPrompt(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildChapterFastGuidancePrompt(input: ChapterFastGuidanceInput) {
  return [
    "请基于 story context 一次性生成当前章节的 plan 和 characterDirection JSON。",
    "",
    "极速精修边界：",
    "- 只做当前章节的写作指导，不写正文，不输出小说片段，不生成下一章。",
    "- plan 必须明确本章目标、核心冲突、情绪弧、关键场景、爽点、角色变化和结尾钩子。",
    "- characterDirection 必须明确角色声线、主动欲望、情绪遮罩、关系压力、动作约束和对白约束。",
    "- 如果存在 interactiveDecision 或 interactiveState，必须体现上一章选择和当前互动状态的影响。",
    "- 必须保护网文节奏：行动推进优先，冲突升级优先，少做设定说明，避免过度文学化。",
    "- 不得改变 story_bible 的不可变设定、角色身份、世界规则、前文事实或当前章节大纲。",
    "- 输出必须短而可执行，避免长篇分析，以减少后续 draft 的上下文负担。",
    "",
    "必须严格输出如下 JSON 结构，顶层只允许包含 plan 和 characterDirection：",
    formatJsonForPrompt(fastGuidanceJsonExample),
    "",
    "story context：",
    formatJsonForPrompt(input.storyContext),
    "",
    "现在只输出极速精修指导 JSON。",
  ].join("\n");
}
