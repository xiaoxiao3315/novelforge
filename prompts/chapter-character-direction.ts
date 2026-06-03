import type {
  ChapterCharacterDirection,
  ChapterCharacterDirectionInput,
} from "@/lib/quality/types";

export type {
  ChapterCharacterDirection,
  ChapterCharacterDirectionInput,
} from "@/lib/quality/types";

export const CHAPTER_CHARACTER_DIRECTION_PROMPT_VERSION = "chapter-character-direction-v1";

export const CHAPTER_CHARACTER_DIRECTION_SYSTEM_PROMPT = [
  "你是中文长篇网文单章角色导演 Agent。",
  "你只负责为当前章节生成角色声线、主动欲望、情绪遮罩、关系压力、动作约束、对白约束和 must avoid。",
  "你不写正文，不生成下一章，不改写章节大纲，不替代章节写作计划。",
  "你的角色导演指令优先级低于 story_bible、characters、previous summaries、interactive state 和 chapter plan。",
  "如果角色导演需求与上层事实或计划冲突，必须服从上层信息，并把冲突内容转化为 mustAvoid 或保守执行约束。",
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
].join(" ");

const characterDirectionJsonExample: ChapterCharacterDirection = {
  povGuidance: "本章视角要贴近主角的行动判断，让读者通过他如何观察、隐瞒和选择来感受压力。",
  focusCharacters: [
    {
      character: "主角",
      activeDesire: "想拿到关键线索，同时避免同伴暴露弱点。",
      emotionalMask: "表面冷静甚至有些刻薄，内里焦虑且不愿承认自己在乎。",
      dialogueVoice: "克制、直接，压力越高越少解释，多用短句和反问。",
      actionPattern: "遇到阻碍时先行动试探，再用对白逼问；关键情绪必须通过选择、停顿、撤回动作或保护行为体现。",
      relationshipPressure: "既需要同伴信任，又害怕把同伴拖进更危险的局面。",
      mustNotDo: ["不要突然变成旁观者。", "不要用不符合角色卡的温柔独白替代行动。"],
    },
  ],
  relationshipBeats: [
    "本章关系压力要通过误解、隐瞒、试探或共同代价呈现，不要只写心理说明。",
  ],
  dialogueRules: [
    "不要长篇解释世界观。",
    "每次让步前必须先暴露一点真实目标或关系压力。",
  ],
  actionRules: [
    "每个关键场景至少让一名角色带着明确欲望进入，并在场景结束时发生态度、筹码或关系位置变化。",
  ],
  hiddenInformation: ["角色知道但暂时不能说出口的信息，必须通过回避、改口或动作破绽暗示。"],
  continuityGuards: [
    "不得违背前文摘要中的既成事实、未解决悬念和角色状态变化。",
    "不得覆盖 chapter plan 中的章节目标、核心冲突和结尾钩子。",
  ],
  mustInclude: ["至少一次让角色用行动承担关系代价，而不是只用旁白说明情绪。"],
  mustAvoid: [
    "不要新增无关角色线。",
    "不要用空泛抒情替代角色行动、对白冲突和关系压力。",
  ],
};

function formatJsonForPrompt(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildChapterCharacterDirectionPrompt(input: ChapterCharacterDirectionInput) {
  return [
    "请基于 story context 为当前章节生成角色导演 JSON。",
    "",
    "角色导演边界：",
    "- 只做当前章节的角色导演，不写正文，不输出小说片段，不生成下一章。",
    "- 角色导演指令只能服务于当前 chapter outline 和 chapter plan，不能改写章节事件、结局方向或世界规则。",
    "- 你的输出必须低于 story_bible、characters、previous summaries、interactive state 和 chapter plan；如果冲突，以上层信息为准。",
    "- 必须围绕角色声线、主动欲望、情绪遮罩、关系压力、动作约束、对白约束和 must avoid 生成可执行指令。",
    "- 每个重要角色都要有主动欲望或压力来源，避免让角色只承担解释设定、旁观剧情或被动接话的功能。",
    "- 情绪必须通过动作、对白、沉默、让步、试探、隐瞒或关系代价体现，不要只写抽象心理标签。",
    "- 对白约束要保护角色卡中的身份、性格、目标、弱点和关系，不要让所有角色说同一种话。",
    "- mustAvoid 必须明确指出本章最容易出现的角色跑偏、关系失真、对白空泛或前文连续性风险。",
    "- 不新增无关角色线，不制造与 story_bible 或前文摘要冲突的新事实。",
    "",
    "必须严格输出如下 JSON 结构，顶层字段不可缺失：",
    formatJsonForPrompt(characterDirectionJsonExample),
    "",
    "story context：",
    formatJsonForPrompt(input.storyContext),
    "",
    "现在只输出 character direction JSON。",
  ].join("\n");
}
