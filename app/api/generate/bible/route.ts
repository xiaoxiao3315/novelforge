import { NextResponse } from "next/server";
import { findPlotFilterLabel } from "@/data/plot-filters";
import { generateDeepSeekJson, getDeepSeekModel } from "@/lib/ai/deepseek";
import { createClient } from "@/lib/supabase/server";
import {
  buildBiblePrompt,
  BIBLE_PROMPT_VERSION,
  validateStoryBibleGenerationSchema,
  type BiblePromptInput,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";

type GenerateBibleBody = {
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

const BIBLE_SYSTEM_PROMPT =
  "你只输出可解析 JSON object。不得生成章节大纲、章节正文、改写、续写、收费、社区或排行榜内容。输出必须是 JSON，不能使用 Markdown。";

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
): BiblePromptInput {
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
  };
}

function buildImmutableRulesText(bible: StoryBible) {
  return bible.immutableRules.map((rule) => `- ${rule}`).join("\n");
}

function buildCharacterRow(projectId: string, character: CharacterCard, sortOrder: number) {
  return {
    project_id: projectId,
    name: character.name,
    role: character.role,
    appearance: character.appearance,
    personality: character.personality,
    goal: character.goal,
    weakness: character.weakness,
    secret: character.secret,
    relationship_to_protagonist: character.relationshipToProtagonist,
    character_arc: character.characterArc,
    sort_order: sortOrder,
    content: character,
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

  const body = (await request.json().catch(() => null)) as GenerateBibleBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("生成故事圣经时不能从前端传 user_id。");
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

  const promptInput = buildPromptInput(visibleProject, config, concept);
  const model = getDeepSeekModel();
  const logInput = {
    project: visibleProject,
    storyConfig: promptInput.config,
    storyConcept: concept,
  };

  async function writeErrorLog(error: string) {
    await supabase.from("generation_logs").insert({
      project_id: visibleProject.id,
      operation: "generate_bible",
      target_type: "story_bible",
      model,
      prompt_version: BIBLE_PROMPT_VERSION,
      input: logInput,
      error,
    });
  }

  let outputText = "";

  try {
    const result = await generateDeepSeekJson({
      systemPrompt: BIBLE_SYSTEM_PROMPT,
      userPrompt: buildBiblePrompt(promptInput),
      maxTokens: 3600,
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

  const validation = validateStoryBibleGenerationSchema(parsed);

  if (!validation.ok) {
    const error = `AI 输出 JSON 未通过故事圣经 schema 校验：${validation.error}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const { bible, characters } = validation;

  const { data: storyBible, error: bibleError } = await supabase
    .from("story_bibles")
    .upsert(
      {
        project_id: visibleProject.id,
        worldview: bible.worldview,
        power_system: bible.powerSystem,
        major_factions: bible.majorFactions,
        main_plot: bible.mainPlot,
        first_volume_plot: bible.firstVolumePlot,
        protagonist_arc: bible.protagonistArc,
        antagonist_plan: bible.antagonistPlan,
        mid_late_foreshadowing: bible.midLateForeshadowing,
        final_truth: bible.finalTruth,
        immutable_rules: buildImmutableRulesText(bible),
        content: bible,
      },
      { onConflict: "project_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (bibleError || !storyBible) {
    const error = bibleError?.message || "故事圣经保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: deleteCharactersError } = await supabase
    .from("characters")
    .delete()
    .eq("project_id", visibleProject.id);

  if (deleteCharactersError) {
    const error = `旧角色卡清理失败：${deleteCharactersError.message}`;
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: characterError } = await supabase
    .from("characters")
    .insert(
      characters.map((character, index) =>
        buildCharacterRow(visibleProject.id, character, index),
      ),
    );

  if (characterError) {
    const error = characterError.message || "角色卡保存失败。";
    await writeErrorLog(error);
    return serverError(error);
  }

  const { error: logError } = await supabase.from("generation_logs").insert({
    project_id: visibleProject.id,
    operation: "generate_bible",
    target_type: "story_bible",
    target_id: storyBible.id,
    model,
    prompt_version: BIBLE_PROMPT_VERSION,
    input: logInput,
    output: {
      bible,
      characters,
    },
  });

  if (logError) {
    return serverError(`故事圣经已保存，但生成日志写入失败：${logError.message}`);
  }

  return NextResponse.json({
    bibleId: storyBible.id,
    bible,
    characters,
  });
}
