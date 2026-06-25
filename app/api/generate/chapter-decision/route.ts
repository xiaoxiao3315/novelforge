import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import {
  buildChapterDecisionGenerationMetadata,
  generateChapterDecision,
} from "@/lib/interactive/chapter-decision-generation";
import { requestHasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle, saveInternalChapter } from "@/lib/internal/store";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import {
  type ChapterDecisionPreviousContext,
  type ChapterDecisionPromptInput,
} from "@/prompts/chapter-decision";
import { buildPreviousChapterContext } from "@/prompts/chapter";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  normalizeChapterOutlines,
  normalizeVolumeOutline,
  type ChapterOutline,
  type VolumeOutline,
} from "@/prompts/outline";
import type { NextRequest } from "next/server";

type GenerateDecisionBody = {
  projectId?: unknown;
  chapterId?: unknown;
  chapterNumber?: unknown;
  user_id?: unknown;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
};

type StoryConfigRow = {
  theme: string | null;
  genre: string | null;
  background: string | null;
  world_setting: string | null;
  protagonist: string | null;
  core_conflict: string | null;
  tone: string | null;
  serial_structure: string | null;
  extra_ideas: string | null;
  config_json: unknown;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function buildPromptInput(
  project: ProjectRow,
  config: StoryConfigRow,
  concept: StoryConcept,
  bible: StoryBible,
  characters: CharacterCard[],
  volume: VolumeOutline,
  chapter: ChapterOutline,
  previousChapters: ChapterDecisionPreviousContext[],
): ChapterDecisionPromptInput {
  return {
    project,
    config: {
      ...buildStoryConfigPromptData(config),
    },
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters,
  };
}

export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateDecisionBody | null;

  if (!body || typeof body !== "object") {
    return validationError("Invalid request body.");
  }

  if ("user_id" in body) {
    return validationError("chapter-decision does not accept user_id.");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isInteger(body.chapterNumber)
      ? body.chapterNumber
      : null;

  if (!projectId) {
    return validationError("Missing project.");
  }

  if (!chapterId && !chapterNumber) {
    return validationError("Missing chapter outline.");
  }

  const bundle = await getInternalProjectBundle(projectId);
  const config = bundle?.config ?? null;

  if (!bundle || !config) {
    return validationError("Missing project.");
  }

  if (getProjectModeFromConfig(config.config_json) !== "interactive") {
    return validationError("Only interactive projects can generate chapter decisions.");
  }

  const visibleProject: ProjectRow = {
    id: bundle.project.id,
    title: bundle.project.title,
    description: bundle.project.description,
  };
  const concept = normalizeStoryConcept(bundle.concept);

  if (!concept) {
    return validationError("Missing story_concept.");
  }

  const bible = normalizeStoryBible(bundle.bible);

  if (!bible) {
    return validationError("Missing story_bible.");
  }

  const characters = normalizeCharacterCards(bundle.characters);

  if (characters.length === 0) {
    return validationError("Missing characters.");
  }

  const chapterRow =
    (chapterId ? bundle.chapters.find((chapter) => chapter.id === chapterId) : null) ??
    (chapterNumber
      ? bundle.chapters.find((chapter) => chapter.chapter_number === chapterNumber)
      : null);
  const chapter = chapterRow ? normalizeChapterOutlines([chapterRow.content])[0] ?? null : null;

  if (!chapterRow || !chapter) {
    return validationError("Missing chapter outline.");
  }

  if (!chapterRow.volume_id) {
    return validationError("Missing chapter volume.");
  }

  const volumeRow = bundle.volumes.find((volume) => volume.id === chapterRow.volume_id);
  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    return validationError("Missing volume.");
  }

  const previousChapters = bundle.chapters
    .filter((row) => row.chapter_number < chapter.chapterNumber)
    .sort((left, right) => left.chapter_number - right.chapter_number)
    .map((row) => {
      const outline = normalizeChapterOutlines([row.content])[0] ?? null;
      const context = outline ? buildPreviousChapterContext(outline, row.content) : null;

      if (!outline || !context) {
        return null;
      }

      return {
        ...outline,
        summaryText: context.summary
          ? [
              ...context.summary.keyEvents,
              ...context.summary.characterStateChanges,
              ...context.summary.unresolvedQuestions,
            ].join("；")
          : context.draftExcerpt,
      };
    })
    .filter((item): item is ChapterDecisionPreviousContext => Boolean(item));
  const promptInput = buildPromptInput(
    visibleProject,
    config as StoryConfigRow,
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters,
  );
  const currentChapterContext = buildPreviousChapterContext(chapter, chapterRow.content);
  const decisionResult = await generateChapterDecision({
    ...promptInput,
    currentChapterBody: currentChapterContext.draftExcerpt,
  });

  if (!decisionResult.ok) {
    return serverError(decisionResult.error);
  }

  const decision = decisionResult.decision;
  const existingContentRecord =
    typeof chapterRow.content === "object" && chapterRow.content
      ? (chapterRow.content as Record<string, unknown>)
      : {};
  const existingContent = { ...existingContentRecord };
  delete existingContent.decision;
  delete existingContent.decisionGeneration;
  delete existingContent.stateChanges;
  const chapterContent = {
    ...existingContent,
    ...chapter,
    decision,
    decisionGeneration: buildChapterDecisionGenerationMetadata({
      source: "manual-regeneration",
    }),
  };
  const savedChapter = await saveInternalChapter(projectId, chapterRow.id, chapterContent);

  if (!savedChapter) {
    return serverError("Chapter decision save failed.");
  }

  return NextResponse.json({
    chapterId: savedChapter.id,
    decision,
    decisionGeneration: chapterContent.decisionGeneration,
  });
}
