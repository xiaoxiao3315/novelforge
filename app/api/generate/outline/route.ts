import { NextResponse } from "next/server";
import { findPlotFilterLabel } from "@/data/plot-filters";
import { generateDeepSeekJson, getDeepSeekModel } from "@/lib/ai/deepseek";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  buildOutlinePrompt,
  OUTLINE_PROMPT_VERSION,
  validateOutlineGenerationSchema,
  type ChapterOutline,
  type OutlinePromptInput,
  type VolumeOutline,
} from "@/prompts/outline";

type GenerateOutlineBody = {
  projectId?: unknown;
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

type VolumeIdRow = {
  id: string;
};

const OUTLINE_SYSTEM_PROMPT =
  "你只输出可解析 JSON object。只生成第一卷章节大纲，不得生成章节正文、TipTap、改写、续写、收费、社区或排行榜内容。输出必须是 JSON，不能使用 Markdown。";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as unknown;
}

function buildPromptInput(
  project: ProjectRow,
  config: StoryConfigRow,
  concept: StoryConcept,
  bible: StoryBible,
  characters: CharacterCard[],
): OutlinePromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: {
      theme: findPlotFilterLabel("themes", config.theme),
      genre: findPlotFilterLabel("genres", config.genre),
      background: findPlotFilterLabel("backgrounds", config.background),
      worldSetting: findPlotFilterLabel("worldSettings", config.world_setting),
      protagonist: findPlotFilterLabel("protagonists", config.protagonist),
      coreConflict: findPlotFilterLabel("coreConflicts", config.core_conflict),
      tone: findPlotFilterLabel("tones", config.tone),
      serialStructure: findPlotFilterLabel("serialStructures", config.serial_structure),
      extraIdeas: config.extra_ideas,
    },
    concept,
    bible,
    characters,
  };
}

function buildVolumeRow(projectId: string, volume: VolumeOutline) {
  return {
    project_id: projectId,
    volume_number: volume.volumeNumber,
    title: volume.title,
    summary: volume.summary,
    main_conflict: volume.mainConflict,
    ending_hook: volume.endingHook,
    content: volume,
  };
}

function buildChapterRow(projectId: string, volumeId: string, chapter: ChapterOutline) {
  return {
    project_id: projectId,
    volume_id: volumeId,
    chapter_number: chapter.chapterNumber,
    title: chapter.title,
    event: chapter.event,
    conflict: chapter.conflict,
    character_change: chapter.characterChange,
    highlight: chapter.highlight,
    foreshadowing: chapter.foreshadowing,
    ending_hook: chapter.endingHook,
    estimated_words: chapter.estimatedWords,
    content: chapter,
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

  const body = (await request.json().catch(() => null)) as GenerateOutlineBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成章节大纲时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return validationError("缺少 project。");
  }

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

  const { data: config, error: configError } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfigRow>();

  if (configError) {
    return serverError(configError.message);
  }

  if (!config) {
    return validationError("缺少 story_config。");
  }

  const { data: storyConcept, error: conceptError } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();

  if (conceptError) {
    return serverError(conceptError.message);
  }

  const concept = normalizeStoryConcept(storyConcept?.content);

  if (!concept) {
    return validationError("缺少 story_concept。");
  }

  const { data: storyBible, error: bibleError } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryBibleRow>();

  if (bibleError) {
    return serverError(bibleError.message);
  }

  const bible = normalizeStoryBible(storyBible?.content);

  if (!bible) {
    return validationError("缺少 story_bible。");
  }

  const { data: characterRows, error: charactersError } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();

  if (charactersError) {
    return serverError(charactersError.message);
  }

  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  if (characters.length === 0) {
    return validationError("缺少 characters。");
  }

  const promptInput = buildPromptInput(visibleProject, config, concept, bible, characters);
  const model = getDeepSeekModel();
  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
    storyConcept: concept,
    storyBible: bible,
    characters,
  };

  async function writeErrorLog(error: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_outline",
      target_type: "volume",
      model,
      prompt_version: OUTLINE_PROMPT_VERSION,
      input: logInput,
      error,
    });
  }

  let outputText = "";

  try {
    const result = await generateDeepSeekJson({
      systemPrompt: OUTLINE_SYSTEM_PROMPT,
      userPrompt: buildOutlinePrompt(promptInput),
      maxTokens: 7200,
    });

    outputText = result.outputText;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DeepSeek 请求失败。";
    const errorMessage = `DeepSeek 生成失败：${message.slice(0, 800)}`;
    await writeErrorLog(errorMessage);
    return serverError(errorMessage);
  }

  if (!outputText) {
    const error = "DeepSeek 响应缺少 JSON 文本。";
    await writeErrorLog(error);
    return serverError(error);
  }

  let parsed: unknown;

  try {
    parsed = parseJsonObject(outputText);
  } catch {
    const error = "AI 输出不是有效 JSON。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const validation = validateOutlineGenerationSchema(parsed);

  if (!validation.ok) {
    const error = `AI 输出 JSON 未通过章节大纲 schema 校验：${validation.error}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const { volume, chapters } = validation;

  const { data: savedVolume, error: volumeError } = await supabase
    .from("volumes")
    .upsert(buildVolumeRow(visibleProject.id, volume), {
      onConflict: "project_id,volume_number",
    })
    .select("id")
    .single<VolumeIdRow>();

  if (volumeError || !savedVolume) {
    const error = volumeError?.message || "卷信息保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: chapterError } = await supabase
    .from("chapters")
    .upsert(
      chapters.map((chapter) => buildChapterRow(visibleProject.id, savedVolume.id, chapter)),
      { onConflict: "project_id,chapter_number" },
    );

  if (chapterError) {
    const error = chapterError.message || "章节大纲保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: logError } = await supabase.from("generation_logs").insert({
    project_id: visibleProject.id,
    operation: "generate_outline",
    target_type: "volume",
    target_id: savedVolume.id,
    model,
    prompt_version: OUTLINE_PROMPT_VERSION,
    input: logInput,
    output: {
      volume,
      chapters,
    },
  });

  if (logError) {
    return serverError(`章节大纲已保存，但生成日志写入失败：${logError.message}`);
  }

  return NextResponse.json({
    volumeId: savedVolume.id,
    volume,
    chapters,
  });
}
