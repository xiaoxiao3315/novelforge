import { NextResponse } from "next/server";
import { buildStoryConfigPromptData } from "@/data/plot-filters";
import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { parseJsonObject } from "@/lib/ai/json";
import { GENERATION_CREDIT_COSTS } from "@/lib/credits";
import { getInternalProjectBundle, saveInternalOutline } from "@/lib/internal/store";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  buildOutlinePrompt,
  normalizeOutlineGenerationOptions,
  validateOutlineGenerationSchema,
  type NormalizedOutlineGenerationOptions,
  type OutlinePromptInput,
} from "@/prompts/outline";

type GenerateOutlineBody = {
  projectId?: unknown;
  user_id?: unknown;
  startChapterNumber?: unknown;
  volumeNumber?: unknown;
  chapterCount?: unknown;
  maxChapterNumber?: unknown;
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

const OUTLINE_GENERATION_ATTEMPTS = 2;
const OUTLINE_MAX_TOKENS = 8192;
const OUTLINE_TEMPERATURE = 0.1;
const RAW_OUTPUT_PREVIEW_LENGTH = 1000;
const OUTLINE_SYSTEM_PROMPT = [
  "你只输出一个可被 JSON.parse 解析的 JSON object。",
  "不要 Markdown。不要代码块。不要解释。不要任何 JSON 前后的多余文本。",
  "首字符必须是 {，末字符必须是 }。",
  "严格匹配用户提供的目标 JSON 结构：顶层只能包含 volume 和 chapters。",
  "只生成用户指定卷和章节范围的章节大纲，不得生成章节正文、TipTap、改写、续写、收费、社区或排行榜内容。",
].join(" ");

type JsonParseFailure = {
  attempt: number;
  errorType: string;
  message: string;
  outputLength: number;
  finishReason: string | null;
  rawPreview: string;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getErrorType(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return typeof error;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildJsonParseFailure(
  attempt: number,
  outputText: string,
  finishReason: string | null,
  error: unknown,
): JsonParseFailure {
  return {
    attempt,
    errorType: getErrorType(error),
    message: getErrorMessage(error).slice(0, 800),
    outputLength: outputText.length,
    finishReason,
    rawPreview: outputText.slice(0, RAW_OUTPUT_PREVIEW_LENGTH),
  };
}

function buildEmptyOutputFailure(
  attempt: number,
  finishReason: string | null,
): JsonParseFailure {
  return {
    attempt,
    errorType: "EmptyOutput",
    message: "DeepSeek 响应缺少 JSON 文本。",
    outputLength: 0,
    finishReason,
    rawPreview: "",
  };
}

function formatJsonParseFailureLog(failures: JsonParseFailure[]) {
  return [
    `AI 输出不是有效 JSON（已尝试 ${failures.length} 次）。`,
    ...failures.flatMap((failure) => [
      [
        `attempt=${failure.attempt}`,
        `errorType=${failure.errorType}`,
        `message=${failure.message}`,
        `outputLength=${failure.outputLength}`,
        `finishReason=${failure.finishReason ?? "unknown"}`,
        `rawPreviewFirst${RAW_OUTPUT_PREVIEW_LENGTH}Chars:`,
      ].join("; "),
      failure.rawPreview,
    ]),
  ].join("\n");
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
      ...buildStoryConfigPromptData(config),
    },
    concept,
    bible,
    characters,
  };
}

export async function POST(request: Request) {
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

  const outlineOptionsResult = normalizeOutlineGenerationOptions({
    startChapterNumber: body.startChapterNumber,
    volumeNumber: body.volumeNumber,
    chapterCount: body.chapterCount,
    maxChapterNumber: body.maxChapterNumber,
  });

  if (!outlineOptionsResult.ok) {
    return validationError(outlineOptionsResult.error);
  }

  const outlineOptions: NormalizedOutlineGenerationOptions = outlineOptionsResult.options;
  const bundle = await getInternalProjectBundle(projectId);
  const concept = normalizeStoryConcept(bundle?.concept);
  const bible = normalizeStoryBible(bundle?.bible);
  const characters = normalizeCharacterCards(bundle?.characters ?? []);

  if (!bundle?.config || !concept || !bible || characters.length === 0) {
    return validationError("缺少 story_bible。");
  }

  const promptInput = buildPromptInput(bundle.project, bundle.config, concept, bible, characters);
  const userPrompt = buildOutlinePrompt(promptInput, outlineOptions);
  const parseFailures: JsonParseFailure[] = [];
  let parsed: unknown;
  let parsedSuccessfully = false;

  for (let attempt = 1; attempt <= OUTLINE_GENERATION_ATTEMPTS; attempt += 1) {
    let result: Awaited<ReturnType<typeof generateDeepSeekJson>>;

    try {
      result = await generateDeepSeekJson({
        systemPrompt: OUTLINE_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: OUTLINE_MAX_TOKENS,
        temperature: OUTLINE_TEMPERATURE,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      return serverError(`DeepSeek 生成失败（第 ${attempt} 次）：${message.slice(0, 800)}`);
    }

    if (!result.outputText) {
      parseFailures.push(buildEmptyOutputFailure(attempt, result.finishReason));
    } else {
      try {
        parsed = parseJsonObject(result.outputText);
        parsedSuccessfully = true;
        break;
      } catch (error) {
        parseFailures.push(
          buildJsonParseFailure(attempt, result.outputText, result.finishReason, error),
        );
      }
    }
  }

  if (!parsedSuccessfully) {
    return serverError(formatJsonParseFailureLog(parseFailures));
  }

  const validation = validateOutlineGenerationSchema(parsed, outlineOptions);

  if (!validation.ok) {
    return serverError(`AI 输出 JSON 未通过章节大纲 schema 校验：${validation.error}`);
  }

  const volumeId = await saveInternalOutline(projectId, validation.volume, validation.chapters);

  return NextResponse.json({
    volumeId,
    outlineOptions,
    volume: validation.volume,
    chapters: validation.chapters,
    credits: {
      cost: GENERATION_CREDIT_COSTS.generate_outline,
      balance: 9999,
    },
  });
}
