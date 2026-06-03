# WO-Q008: Character Director Agent

## Scope

WO-Q008 adds a character direction step to high quality chapter generation only.
The quality pipeline is now:

```text
Plan -> Character Direction -> Draft -> Critique -> Rewrite
```

Normal chapter generation does not enable character direction and continues to
call the existing chapter prompt directly. This work does not add migrations,
database schema changes, API routes, UI controls, payment changes, provider
changes, Fal integration, or a new credit price.

## Character Direction Output

`prompts/chapter-character-direction.ts` defines
`chapter-character-direction-v1`. It asks DeepSeek to return a JSON object with
this shape:

```ts
type ChapterCharacterDirection = {
  povGuidance: string;
  focusCharacters: {
    character: string;
    activeDesire: string;
    emotionalMask: string;
    dialogueVoice: string;
    actionPattern: string;
    relationshipPressure: string;
    mustNotDo: string[];
  }[];
  relationshipBeats: string[];
  dialogueRules: string[];
  actionRules: string[];
  hiddenInformation: string[];
  continuityGuards: string[];
  mustInclude: string[];
  mustAvoid: string[];
};
```

The prompt only directs character execution for the current chapter. It must not
write prose, generate the next chapter, replace the chapter plan, override
`story_bible` immutable rules, or change saved character cards and continuity.

## Pipeline Behavior

`runChapterQualityPipeline` accepts `enableCharacterDirection`.

- `enableCharacterDirection: false` keeps the previous quality pipeline.
- `enableCharacterDirection: true` requires a successful plan first.
- Character direction failure returns a structured failed result with
  `steps.characterDirection = "failed"`.
- Draft receives both `chapterPlan` and `chapterCharacterDirection`.
- Critique and rewrite receive the same story context, including the character
  direction when enabled.
- Rewrite remains single-pass. There is no self-review loop or second rewrite.

The pipeline still does not write the database, spend credits, or write
`generation_logs`; API code owns those side effects.

## API Integration

`/api/generate/chapter` enables character direction only when:

```json
{
  "qualityMode": "quality"
}
```

Normal mode and omitted `qualityMode` do not pass `enableCharacterDirection` and
do not inject character direction into `buildChapterPrompt`.

Quality mode uses existing DeepSeek helpers:

- Plan: `chapter-plan-v1`, JSON output.
- Character Direction: `chapter-character-direction-v1`, JSON output.
- Draft: existing `chapter-v1`, with optional plan and character direction.
- Critique: `chapter-critique-v1`, JSON output.
- Rewrite: `chapter-rewrite-v1`, text output.

Any failure in plan, character direction, draft, critique, rewrite, or summary
returns before saving chapter content, inserting a chapter version, or spending
credits.

## Metadata

High quality success stores the full character direction in:

```text
chapters.content.draft.quality.characterDirection
```

`generation_logs.output.quality.characterDirection` stores a compact summary:

- `povGuidance`
- focus character count
- first few focus character voice/desire/relationship notes
- first few relationship beats, dialogue rules, action rules, continuity guards,
  must-include notes, and must-avoid notes

## Cost

WO-Q008 keeps the existing `generate_chapter_quality = 20` cost. Character
direction adds one extra model call, so a later cost WO should decide whether
the high quality price should increase.

## Supabase Verification SQL

Check saved character direction metadata:

```sql
select
  id,
  chapter_number,
  content->'draft'->'quality'->'characterDirection' as character_direction
from chapters
where id = '<chapter_id>';
```

Check quality generation logs:

```sql
select
  id,
  output->'quality'->'steps' as quality_steps,
  output->'quality'->'characterDirection' as character_direction_summary,
  output->'quality'->'critique'->>'overallScore' as overall_score,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter'
  and target_id = '<chapter_id>'
order by created_at desc
limit 10;
```

Check character direction failures:

```sql
select
  id,
  input->'qualityPipeline'->'steps' as input_steps,
  error,
  created_at
from generation_logs
where operation = 'generate_chapter'
  and target_id = '<chapter_id>'
  and error is not null
order by created_at desc
limit 10;
```
