import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { getDeepSeekModel } from "@/lib/ai/deepseek";
import {
  buildChapterDecisionGenerationLogError,
  buildChapterDecisionGenerationMetadata,
  generateChapterDecision,
} from "@/lib/interactive/chapter-decision-generation";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import {
  CHAPTER_DECISION_PROMPT_VERSION,
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

type StoryConceptRow = {
  content: StoryConcept | null;
};

type StoryBibleRow = {
  content: StoryBible | null;
};

type CharacterRow = {
  content: CharacterCard | null;
};

type VolumeRow = {
  content: unknown;
};

type ChapterRow = {
  id: string;
  content: unknown;
  chapter_number: number;
  title: string;
  event: string;
  conflict: string;
  character_change: string;
  highlight: string;
  foreshadowing: string;
  ending_hook: string;
  estimated_words: number;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function buildChapterOutline(row: ChapterRow): ChapterOutline | null {
  return (
    normalizeChapterOutlines([
      {
        chapterNumber: row.chapter_number,
        title: row.title,
        event: row.event,
        conflict: row.conflict,
        characterChange: row.character_change,
        highlight: row.highlight,
        foreshadowing: row.foreshadowing,
        endingHook: row.ending_hook,
        estimatedWords: row.estimated_words,
      },
    ])[0] ?? null
  );
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateDecisionBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成剧情选择时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "number" && Number.isInteger(body.chapterNumber)
      ? body.chapterNumber
      : null;

  if (!projectId) {
    return validationError("缺少 project。");
  }

  if (!chapterId && !chapterNumber) {
    return validationError("缺少 chapter outline。");
  }

  const model = getDeepSeekModel();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    return serverError(projectError.message);
  }

  if (!project) {
    return validationError("缺少 project。");
  }

  const visibleProject = project;

  async function writeDecisionErrorLog(error: string, input: Record<string, unknown>, targetId?: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_chapter_decision",
      target_type: "chapter",
      ...(targetId ? { target_id: targetId } : {}),
      model,
      prompt_version: CHAPTER_DECISION_PROMPT_VERSION,
      input,
      error,
    });
  }

  const { data: config, error: configError } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas,config_json",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfigRow>();

  if (configError) {
    return serverError(configError.message);
  }

  if (!config) {
    return validationError("缺少 story_config。");
  }

  if (getProjectModeFromConfig(config.config_json) !== "interactive") {
    return validationError("只有互动剧情模式项目可以生成剧情选择。");
  }

  const { data: storyConcept } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();
  const concept = normalizeStoryConcept(storyConcept?.content);

  if (!concept) {
    return validationError("缺少 story_concept。");
  }

  const { data: storyBible } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryBibleRow>();
  const bible = normalizeStoryBible(storyBible?.content);

  if (!bible) {
    return validationError("缺少 story_bible。");
  }

  const { data: characterRows } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();
  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  if (characters.length === 0) {
    return validationError("缺少 characters。");
  }

  const { data: volumeRow } = await supabase
    .from("volumes")
    .select("content")
    .eq("project_id", projectId)
    .order("volume_number", { ascending: true })
    .limit(1)
    .maybeSingle<VolumeRow>();
  const volume = normalizeVolumeOutline(volumeRow?.content);

  if (!volume) {
    return validationError("缺少 volume。");
  }

  let chapterQuery = supabase
    .from("chapters")
    .select(
      "id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
    )
    .eq("project_id", projectId);

  if (chapterId) {
    chapterQuery = chapterQuery.eq("id", chapterId);
  } else if (chapterNumber) {
    chapterQuery = chapterQuery.eq("chapter_number", chapterNumber);
  }

  const { data: chapterRow, error: chapterError } = await chapterQuery.maybeSingle<ChapterRow>();

  if (chapterError) {
    return serverError(chapterError.message);
  }

  const chapter = chapterRow ? buildChapterOutline(chapterRow) : null;

  if (!chapterRow || !chapter) {
    return validationError("缺少 chapter outline。");
  }

  const { data: previousRows } = await supabase
    .from("chapters")
    .select(
      "id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
    )
    .eq("project_id", projectId)
    .lt("chapter_number", chapter.chapterNumber)
    .order("chapter_number", { ascending: true })
    .returns<ChapterRow[]>();
  const previousChapters = (previousRows ?? [])
    .map((row) => {
      const outline = buildChapterOutline(row);
      const context = outline ? buildPreviousChapterContext(outline, row.content) : null;

      if (!context) {
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
    config,
    concept,
    bible,
    characters,
    volume,
    chapter,
    previousChapters,
  );
  const currentChapterContext = buildPreviousChapterContext(chapter, chapterRow.content);
  const promptInputWithBody = {
    ...promptInput,
    currentChapterBody: currentChapterContext.draftExcerpt,
  };
  const logInput = {
    project: visibleProject,
    storyConfig: promptInputWithBody.config,
    storyConcept: concept,
    storyBible: bible,
    characters,
    volume,
    chapter,
    previousChapters,
    currentChapterBodyPreview: currentChapterContext.draftExcerpt,
  };

  const decisionResult = await generateChapterDecision(promptInputWithBody);

  if (!decisionResult.ok) {
    const error = buildChapterDecisionGenerationLogError(decisionResult);
    await writeDecisionErrorLog(error, logInput, chapterRow.id);
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
  const { data: savedChapter, error: updateError } = await supabase
    .from("chapters")
    .update({ content: chapterContent })
    .eq("id", chapterRow.id)
    .eq("project_id", visibleProject.id)
    .eq("user_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (updateError || !savedChapter) {
    return serverError(updateError?.message || "剧情选择保存失败。");
  }

  await supabase.from("generation_logs").insert({
    project_id: visibleProject.id,
    operation: "generate_chapter_decision",
    target_type: "chapter",
    target_id: savedChapter.id,
    model,
    prompt_version: CHAPTER_DECISION_PROMPT_VERSION,
    input: logInput,
    output: { decision, source: "manual-regeneration" },
  });

  return NextResponse.json({
    chapterId: savedChapter.id,
    decision,
    decisionGeneration: chapterContent.decisionGeneration,
  });
}
