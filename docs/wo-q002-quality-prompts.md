# WO-Q002 质量类型与 Prompt 草案

WO-Q002 在 NovelForge 中新增 Novel Quality Engine 的最小代码基础，但暂不接入任何真实生成流程。

## 新增范围

- `lib/quality/types.ts`：章节质量评分、审稿结果、质量上下文、修订输入和 pipeline metadata 类型。
- `lib/quality/validators.ts`：轻量手写 validator，用于校验并 normalize `ChapterQualityCritique`。
- `prompts/chapter-critique.ts`：章节审稿 prompt builder，版本 `chapter-critique-v1`。
- `prompts/chapter-rewrite.ts`：章节修订 prompt builder，版本 `chapter-rewrite-v1`。

## 当前不做

- 不新增 API route。
- 不修改 `/api/generate/chapter`。
- 不修改 `prompts/chapter.ts` 默认行为。
- 不新增 migration。
- 不改数据库、点数系统或 DeepSeek provider。
- 不接真实 `Draft -> Critique -> Rewrite` pipeline。

## 质量评分维度

评分范围为 0-100：

- `pacing`：节奏。
- `conflict`：冲突。
- `emotion`：情绪。
- `characterConsistency`：人物一致性。
- `worldConsistency`：设定一致性。
- `proseQuality`：语言质感。
- `hookStrength`：结尾钩子。
- `commercialAppeal`：商业可读性 / 追更欲。

## Validator 行为

`validateChapterQualityCritique` 会检查：

- 顶层字段完整。
- `scores` 包含全部评分字段。
- 所有评分和 `overallScore` 是数字，并 clamp 到 0-100。
- `strengths`、`weaknesses`、`revisionDirectives`、`continuityRisks`、`mustKeep`、`mustFix` 都是字符串数组。

`normalizeChapterQualityCritique` 在校验成功时返回清洗后的 critique，失败时返回 `null`。

## 后续接入点

WO-Q003 可以基于这些文件新增 pipeline service：

1. 调用现有 draft 生成能力。
2. 使用 `buildChapterCritiquePrompt` 生成 critique JSON。
3. 用 validator 校验 critique。
4. 使用 `buildChapterRewritePrompt` 生成修订正文。
5. 仍然不改变普通生成的默认行为，直到 API 接入 WO 明确授权。
