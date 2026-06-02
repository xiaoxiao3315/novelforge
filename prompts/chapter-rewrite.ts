import type { ChapterRewriteInput } from "@/lib/quality/types";

export const CHAPTER_REWRITE_PROMPT_VERSION = "chapter-rewrite-v1";

export const CHAPTER_REWRITE_SYSTEM_PROMPT = [
  "你是中文长篇网文章节修订写手。",
  "你只输出修订后的中文小说正文。",
  "不要 Markdown，不要代码块，不要解释，不要标题分析。",
  "不要提前生成下一章，不要总结整本小说。",
  "必须遵守 story_bible 的不可变设定和前文连续性。",
].join(" ");

function formatJsonForPrompt(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildChapterRewritePrompt(input: ChapterRewriteInput) {
  return [
    "请根据 critique 修订章节原稿。",
    "",
    "硬性要求：",
    "- 只输出修订后的章节正文，不输出解释、批注、Markdown 或代码块。",
    "- 只修订当前章节，不提前生成下一章。",
    "- 不改变 story_bible 的不可变设定、世界规则、人物身份和前文事实。",
    "- 不抹掉原稿中有效的爽点、情绪点、反转、伏笔和章末压力。",
    "- 不把网文节奏改慢，不用长篇背景说明替代行动推进。",
    "- 优先修复 critique.mustFix 和 critique.revisionDirectives。",
    "- 保留 critique.mustKeep 中列出的有效内容。",
    "- 强化节奏、冲突、情绪、人物一致性、设定一致性、语言质感、结尾钩子和追更欲。",
    "- 如需补充描写，优先补行动、对话、代价、危险和关系张力，不堆砌形容词。",
    "- 修订后正文应保持原章节目标和大纲方向，不新增无关支线。",
    "",
    "story context：",
    formatJsonForPrompt(input.storyContext),
    "",
    "critique：",
    formatJsonForPrompt(input.critique),
    "",
    "原稿：",
    input.originalDraft,
    "",
    "现在只输出修订后的章节正文。",
  ].join("\n");
}
