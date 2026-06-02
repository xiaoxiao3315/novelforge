# WO-Q005: Frontend Quality Mode Toggle

## Scope

WO-Q005 adds a frontend-only choice for chapter generation quality mode and aligns the credit cost with the optional API support added in WO-Q004.

No database schema, migration, provider behavior, or default chapter prompt behavior is changed.

## UI Behavior

- Chapter generation still defaults to normal mode.
- Each chapter card exposes two explicit choices:
  - Normal generation: fast generation, 8 credits.
  - Quality generation: draft, AI critique, and conditional rewrite, 20 credits.
- Quality mode explains that it takes longer and is intended for formal chapters.
- If the selected mode costs more than the current balance, the generate button is disabled and a shortfall message is shown.

## API Payload

Normal mode sends:

```json
{
  "qualityMode": "normal"
}
```

Quality mode sends:

```json
{
  "qualityMode": "quality"
}
```

The API still treats a missing `qualityMode` as normal mode for backward compatibility.

## Credit Cost

- `generate_chapter`: 8 credits.
- `generate_chapter_quality`: 20 credits.

The chapter generation API now checks and spends `generate_chapter_quality` only when `qualityMode === "quality"`. Failed pipeline, rewrite, summary, or persistence steps still return before spending credits.

## Quality Metadata Display

When a saved chapter draft contains `chapters.content.draft.quality`, the project page can display:

- Overall quality score.
- Whether rewrite was applied.
- Key score dimensions.
- Prompt/pipeline mode label when present.

The quality report is intentionally compact and stays outside the main reader body.

## WO-Q006 Handoff

WO-Q006 can add a fuller quality report page, quality history, or admin analytics. This should wait until real API usage has validated the current `draft.quality` metadata shape.
