# WO-Q007: Chapter Planning Agent

## Scope

WO-Q007 adds a chapter planning step to high quality generation only. The quality
pipeline is now:

```text
Plan -> Draft -> Critique -> Rewrite
```

Normal chapter generation does not enable the planner and continues to call the
existing chapter prompt directly. This work does not add migrations, database
schema changes, API routes, UI controls, payment changes, provider changes, or
new external services.

## Planner Output

`prompts/chapter-plan.ts` defines `chapter-plan-v1`. It asks DeepSeek to return a
JSON object with this shape:

```ts
type ChapterWritingPlan = {
  chapterGoal: string;
  coreConflict: string;
  emotionalArc: string;
  keyScenes: string[];
  characterBeats: {
    character: string;
    goal: string;
    emotionalChange: string;
    dialogueTone: string;
  }[];
  suspenseAndHooks: string[];
  mustInclude: string[];
  mustAvoid: string[];
  pacingPlan: string[];
  endingHook: string;
  continuityNotes: string[];
};
```

The prompt only plans the current chapter. It must not write chapter prose,
generate the next chapter, override `story_bible` immutable rules, or sacrifice
web-novel pacing for over-polished prose. Interactive `previousDecision` and
`interactiveState` are included in the planning context when they exist.

## Validator

`lib/quality/validators.ts` validates the planner output with a lightweight
manual validator:

- Top-level value must be a JSON object.
- Required string fields must exist and be non-empty.
- Required array fields must exist and contain only strings.
- `characterBeats` must be an array of objects with `character`, `goal`,
  `emotionalChange`, and `dialogueTone`.
- Extra fields are ignored by normalization.

If validation fails, the quality pipeline fails at `plan` and does not enter
draft generation.

## Pipeline Behavior

`runChapterQualityPipeline` accepts `enablePlanning`.

- `enablePlanning: false` keeps the existing Draft -> Critique -> Rewrite flow.
- `enablePlanning: true` requires a `generatePlan` callback.
- Plan failure returns a structured failed result with `steps.plan = "failed"`.
- Draft receives `chapterPlan` and the story context also includes
  `chapterPlan`.
- Critique and rewrite continue to receive the same story context, now including
  the plan when planning is enabled.
- Rewrite remains single-pass. There is no self-review loop or second rewrite.

The pipeline still does not write the database, spend credits, or write
`generation_logs`; API code owns those side effects.

## API Integration

`/api/generate/chapter` enables planning only when:

```json
{
  "qualityMode": "quality"
}
```

Normal mode and omitted `qualityMode` do not pass `enablePlanning` and do not
inject `chapterPlan` into `buildChapterPrompt`.

Quality mode uses existing DeepSeek helpers:

- Plan: `chapter-plan-v1`, JSON output.
- Draft: existing `chapter-v1`, with optional `chapterPlan`.
- Critique: `chapter-critique-v1`, JSON output.
- Rewrite: `chapter-rewrite-v1`, text output.

Any failure in plan, draft, critique, rewrite, or summary returns before saving
chapter content, inserting a chapter version, or spending credits.

## Metadata

High quality success stores the full plan in:

```text
chapters.content.draft.quality.plan
```

`generation_logs.output.quality.plan` stores a compact plan summary:

- `chapterGoal`
- `coreConflict`
- `emotionalArc`
- `endingHook`
- key scene count
- character beat count
- first few hooks, avoid notes, and continuity notes

## Cost

WO-Q007 keeps the existing `generate_chapter_quality = 20` cost. Planner adds one
extra model call, so WO-Q008 can decide whether the high quality cost should
remain 20 or increase.

## Supabase Verification SQL

Check saved plan metadata:

```sql
select
  id,
  chapter_number,
  content->'draft'->'quality'->'plan' as chapter_plan
from chapters
where id = '<chapter_id>';
```

Check quality generation logs:

```sql
select
  id,
  output->'quality'->'steps' as quality_steps,
  output->'quality'->'plan' as plan_summary,
  output->'quality'->'critique'->>'overallScore' as overall_score,
  output->'quality'->>'rewriteApplied' as rewrite_applied,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter'
  and target_id = '<chapter_id>'
order by created_at desc
limit 10;
```

Check planner failures:

```sql
select
  id,
  input->'qualityPipeline'->'steps' as input_steps,
  output->'quality'->'steps' as output_steps,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter'
  and target_id = '<chapter_id>'
  and error is not null
order by created_at desc
limit 10;
```

## WO-Q008 Notes

Recommended WO-Q008 focus:

- Evaluate whether planner cost should change the high quality credit price.
- Add a narrow smoke test fixture for a fake planning callback.
- Optionally surface plan summary in developer-only docs or admin observability,
  without adding user-facing complexity.
