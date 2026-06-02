# WO-Q004 可选高质量章节生成 API 接入

WO-Q004 在现有 `/api/generate/chapter` 中增加可选 `qualityMode` 参数。

## 输入行为

```json
{
  "projectId": "...",
  "chapterId": "...",
  "qualityMode": "quality",
  "intervention": {}
}
```

- 未传 `qualityMode`：按 `normal` 处理。
- `qualityMode: "normal"`：保持现有章节生成行为。
- `qualityMode: "quality"`：进入 `Draft -> Critique -> Rewrite` pipeline。
- 其他值：返回 400。

## 默认行为

默认不传 `qualityMode` 时仍走原来的单次章节正文生成：

1. `buildChapterPrompt`
2. `generateDeepSeekText`
3. 章节 summary
4. `chapter_versions`
5. `chapters.content.draft`
6. `generation_logs`
7. `spendGenerationCredits(generate_chapter)`

本轮不改前端 UI，不自动启用高质量模式。

## Quality pipeline

`qualityMode: "quality"` 时，route 会调用 `runChapterQualityPipeline`：

1. Draft：沿用现有 `CHAPTER_SYSTEM_PROMPT` 和 `buildChapterPrompt`。
2. Critique：调用 `chapter-critique-v1`，使用 JSON 输出，并通过 validator 校验。
3. Rewrite：默认 `score-threshold`，`overallScore < 82` 才执行一次 rewrite。

Pipeline 失败时不进入 summary，不保存正文，不扣点。

## Metadata 保存位置

高质量模式成功后，质量摘要写入：

- `chapters.content.draft.quality`
- `generation_logs.output.quality`
- API response 的 `quality`

核心结构：

```json
{
  "mode": "quality-v1",
  "critique": {
    "overallScore": 78,
    "scores": {}
  },
  "rewriteApplied": true,
  "rewritePolicy": "score-threshold",
  "rewriteScoreThreshold": 82,
  "promptVersions": {
    "critique": "chapter-critique-v1",
    "rewrite": "chapter-rewrite-v1"
  }
}
```

## generation_logs

成功时 `generation_logs.operation = "generate_chapter"`，但 input/output 会额外包含：

- `qualityMode`
- `qualityPipeline.status`
- `qualityPipeline.steps`
- `qualityPipeline.critique.overallScore`
- `qualityPipeline.critique.scores`
- `qualityPipeline.rewriteApplied`
- `qualityPipeline.promptVersions`

失败时写入 `generation_logs.error`，并在 input 中记录 pipeline 摘要。

## 点数

WO-Q004 暂时沿用现有 `generate_chapter` 扣点。

后续 WO 建议新增 `generate_chapter_quality = 20`，并同步更新前端展示、余额校验和成本文案。本轮不改点数系统，避免影响支付和余额页面。

## Supabase 验证 SQL

查看最近高质量章节日志：

```sql
select
  id,
  operation,
  target_type,
  target_id,
  input->>'qualityMode' as quality_mode,
  output->'quality'->'critique'->>'overallScore' as overall_score,
  output->'quality'->>'rewriteApplied' as rewrite_applied,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter'
order by created_at desc
limit 10;
```

查看章节草稿中的质量 metadata：

```sql
select
  id,
  chapter_number,
  title,
  content->'draft'->'quality' as quality
from chapters
where id = '<chapter-id>';
```

确认失败没有污染旧正文：

```sql
select
  id,
  operation,
  error,
  input->>'qualityMode' as quality_mode,
  input->'qualityPipeline' as quality_pipeline,
  created_at
from generation_logs
where error is not null
order by created_at desc
limit 10;
```
