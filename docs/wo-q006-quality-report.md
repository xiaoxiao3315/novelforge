# WO-Q006: Quality Report Display And Summary Repair Observability

## Scope

WO-Q006 improves the chapter quality report display and documents how to observe
chapter summary repair events. It does not add database tables, migrations,
provider changes, payment changes, debug APIs, or new generation loops.

## Quality Metadata

High quality chapter generation writes compact metadata to
`chapters.content.draft.quality`.

Example:

```json
{
  "mode": "quality-v1",
  "status": "success",
  "critique": {
    "overallScore": 80,
    "scores": {
      "pacing": 78,
      "conflict": 85,
      "emotion": 80,
      "characterConsistency": 82,
      "worldConsistency": 84,
      "proseQuality": 79,
      "hookStrength": 72,
      "commercialAppeal": 83
    }
  },
  "rewriteApplied": true,
  "rewritePolicy": "score-threshold",
  "rewriteScoreThreshold": 82,
  "promptVersions": {
    "critique": "chapter-critique-v1",
    "rewrite": "chapter-rewrite-v1"
  },
  "steps": {
    "draft": "success",
    "critique": "success",
    "rewrite": "success"
  }
}
```

The UI reads this object only when it exists. Normal generation does not create
quality metadata, so normal chapters do not show a quality report.

## Quality Report UI

The project page now shows:

- Overall score.
- Pipeline status.
- Rewrite status.
- Pacing.
- Conflict.
- Emotion.
- Character consistency.
- World consistency.
- Prose quality.
- Hook strength.
- Commercial appeal.

The chapter card report is collapsible so it does not crowd the draft body. The
current chapter workbench shows the same dimensions in a compact score panel
outside the reader body.

## Rewrite Detection

Use `rewriteApplied` to decide whether rewrite happened:

- `true`: rewrite ran after critique.
- `false`: critique succeeded and rewrite was skipped, usually because the score
  met the threshold.

The pipeline status is stored as `draft.quality.status` for new high quality
generations. Older drafts may not have this field; the UI can still infer a
successful pipeline from `draft.quality.steps`.

## Summary Repair Metadata

WO-Q005.2 records summary repair observability in `generation_logs` for the
`generate_chapter_summary` operation. It does not require a schema change.

Example success output:

```json
{
  "summary": {},
  "summaryValidation": {
    "attempts": [
      {
        "attempt": 1,
        "validationError": "summary 缺少字段：characterStateChanges。",
        "missingFields": ["characterStateChanges"],
        "extraFields": [],
        "invalidFields": [],
        "retryAttempt": 2,
        "repairedFields": ["characterStateChanges"],
        "summaryRepaired": true
      }
    ],
    "summaryRepaired": true,
    "missingFields": ["characterStateChanges"],
    "repairedFields": ["characterStateChanges"]
  },
  "summaryJsonParseFailures": []
}
```

If the retry produces a valid summary, `summaryRepaired` remains `false` and the
attempt list still records the first schema error. If the retry still only
misses safe fields, fallback repair may set `summaryRepaired` to `true`.

Severe errors still fail:

- Summary output is not a JSON object.
- JSON cannot be parsed.
- Extra schema fields are present.
- Existing fields have severe type mismatches.
- Required fields are present but empty in a non-repairable way.

Failure still returns before saving chapter content, inserting a chapter
version, or spending credits.

## Supabase Verification SQL

Check saved quality metadata:

```sql
select
  id,
  chapter_number,
  title,
  content->'draft'->'quality' as quality
from chapters
where id = '<chapter_id>';
```

Check whether high quality generation executed rewrite:

```sql
select
  id,
  output->'quality'->>'status' as quality_status,
  output->'quality'->>'rewriteApplied' as rewrite_applied,
  output->'quality'->'critique'->>'overallScore' as overall_score,
  output->'quality'->'critique'->'scores' as scores,
  created_at
from generation_logs
where operation = 'generate_chapter'
  and target_id = '<chapter_id>'
order by created_at desc
limit 10;
```

Check summary retry and repair observability:

```sql
select
  id,
  output->'summaryValidation'->>'summaryRepaired' as summary_repaired,
  output->'summaryValidation'->'repairedFields' as repaired_fields,
  output->'summaryValidation'->'attempts' as validation_attempts,
  output->'summaryJsonParseFailures' as json_parse_failures,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter_summary'
  and target_id = '<chapter_id>'
order by created_at desc
limit 10;
```

Check failed summary attempts without dirty writes:

```sql
select
  id,
  error,
  output->'summaryValidation' as summary_validation,
  created_at
from generation_logs
where operation = 'generate_chapter_summary'
  and target_id = '<chapter_id>'
  and error is not null
order by created_at desc
limit 10;
```

