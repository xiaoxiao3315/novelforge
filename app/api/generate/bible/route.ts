import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { parseJsonObject } from "@/lib/ai/json";
import { GENERATION_CREDIT_COSTS } from "@/lib/credits";
import { getInternalProjectBundle, saveInternalBible } from "@/lib/internal/store";
import {
  buildBiblePrompt,
  validateStoryBibleGenerationSchema,
  type BiblePromptInput,
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
  config_json: unknown;
};

const BIBLE_SYSTEM_PROMPT =
  "你只输出可解析 JSON object。不得生成章节大纲、章节正文、改写、续写、收费、社区或排行榜内容。输出必须是 JSON，不能使用 Markdown。";

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
): BiblePromptInput {
  return {
    project: {
      title: project.title,
      description: project.description,
    },
    config: {
      ...buildStoryConfigPromptData(config),
    },
    concept,
  };
}

export async function POST(request: Request) {
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

  const bundle = await getInternalProjectBundle(projectId);
  const concept = normalizeStoryConcept(bundle?.concept);

  if (!bundle?.config || !concept) {
    return validationError("缺少 story_concept。");
  }

  const promptInput = buildPromptInput(bundle.project, bundle.config, concept);
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
    return serverError(`DeepSeek 生成失败：${message.slice(0, 800)}`);
  }

  if (!outputText) {
    return serverError("DeepSeek 响应缺少 JSON 文本。");
  }

  let parsed: unknown;

  try {
    parsed = parseJsonObject(outputText);
  } catch {
    return serverError("AI 输出不是有效 JSON。");
  }

  const validation = validateStoryBibleGenerationSchema(parsed);

  if (!validation.ok) {
    return serverError(`AI 输出 JSON 未通过故事圣经 schema 校验：${validation.error}`);
  }

  const bibleId = await saveInternalBible(projectId, validation.bible, validation.characters);

  return NextResponse.json({
    bibleId,
    bible: validation.bible,
    characters: validation.characters,
    credits: {
      cost: GENERATION_CREDIT_COSTS.generate_bible,
      balance: 9999,
    },
  });
}
