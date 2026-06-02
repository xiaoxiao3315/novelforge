import type { ChapterCritiqueInput, ChapterQualityCritique } from "@/lib/quality/types";

export const CHAPTER_CRITIQUE_PROMPT_VERSION = "chapter-critique-v1";

export const CHAPTER_CRITIQUE_SYSTEM_PROMPT = [
  "你是中文长篇网文章节审稿编辑。",
  "你只负责审稿和给出结构化修订指令，不重写正文。",
  "你必须保护网文节奏，避免把文本改成慢节奏文学散文。",
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown，不要代码块，不要解释，不要输出 JSON 前后的多余文本。",
].join(" ");

const critiqueJsonExample: ChapterQualityCritique = {
  scores: {
    pacing: 78,
    conflict: 74,
    emotion: 70,
    characterConsistency: 82,
    worldConsistency: 86,
    proseQuality: 76,
    hookStrength: 68,
    commercialAppeal: 72,
  },
  overallScore: 76,
  strengths: ["本章主冲突明确，主角主动做出选择。"],
  weaknesses: ["中段解释世界规则偏长，压低了追读节奏。"],
  revisionDirectives: ["压缩中段说明，把设定信息改为角色行动中的阻碍。"],
  continuityRisks: ["能力代价的表现略轻，可能削弱 story_bible 中的不可变规则。"],
  mustKeep: ["保留章末新线索出现的爽点。"],
  mustFix: ["强化结尾钩子的即时危险和下一章追问。"],
};

function formatJsonForPrompt(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildChapterCritiquePrompt(input: ChapterCritiqueInput) {
  return [
    "请审阅下面的章节初稿，并输出质量评估 JSON。",
    "",
    "审稿边界：",
    "- 只审稿，不重写正文。",
    "- 不要续写下一章。",
    "- 不要要求过度文学化，不要用慢节奏抒情替代网文推进。",
    "- 必须指出具体问题，不能只写“需要加强”“不够好”这类空泛评价。",
    "- 每条 revisionDirectives 都必须是可执行的修订动作。",
    "- mustKeep 记录原稿中已经有效的爽点、情绪点、反转、伏笔或人物动作，修订时不得抹掉。",
    "- mustFix 记录必须修复的问题，优先覆盖节奏、冲突、情绪、人物一致性、设定一致性和结尾钩子。",
    "",
    "评分维度，范围 0-100：",
    "- pacing：节奏，检查是否有场景推进、信息释放和快慢变化。",
    "- conflict：冲突，检查阻力、升级、代价和选择是否明确。",
    "- emotion：情绪，检查情绪是否由行动、关系和事件推动。",
    "- characterConsistency：人物一致性，检查角色目标、弱点、声线和关系是否跑偏。",
    "- worldConsistency：设定一致性，检查是否违背 story_bible、世界规则和前文摘要。",
    "- proseQuality：语言质感，检查画面感、句式变化和类型文风，不追求过度文学化。",
    "- hookStrength：结尾钩子，检查章末是否留下明确悬念、压力或追问。",
    "- commercialAppeal：商业可读性 / 追更欲，检查爽点、期待感和读者继续阅读动力。",
    "",
    "必须严格输出如下 JSON 结构，顶层字段不可缺失：",
    formatJsonForPrompt(critiqueJsonExample),
    "",
    "story context：",
    formatJsonForPrompt(input.storyContext),
    "",
    "章节初稿：",
    input.draft,
    "",
    "现在只输出 critique JSON。",
  ].join("\n");
}
