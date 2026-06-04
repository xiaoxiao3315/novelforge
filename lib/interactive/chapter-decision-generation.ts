import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import {
  buildChapterDecisionPrompt,
  CHAPTER_DECISION_PROMPT_VERSION,
  CHAPTER_DECISION_SYSTEM_PROMPT,
  validateChapterDecisionOutput,
  type ChapterDecision,
  type ChapterDecisionPromptInput,
} from "@/prompts/chapter-decision";

export const CHAPTER_DECISION_GENERATION_ATTEMPTS = 2;
export const CHAPTER_DECISION_MAX_TOKENS = 1600;
export const CHAPTER_DECISION_TEMPERATURE = 0.2;

const RAW_PREVIEW_LENGTH = 1000;

export type ChapterDecisionGenerationFailure = {
  attempt: number;
  errorType: string;
  message: string;
  outputLength?: number;
  finishReason?: string | null;
  rawPreview?: string;
};

export type ChapterDecisionGenerationResult =
  | {
      ok: true;
      decision: ChapterDecision;
      failures: ChapterDecisionGenerationFailure[];
    }
  | {
      ok: false;
      error: string;
      failures: ChapterDecisionGenerationFailure[];
    };

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getErrorType(error: unknown) {
  if (error instanceof SyntaxError) {
    return "json_parse";
  }

  if (error instanceof Error) {
    return error.name || "error";
  }

  return "unknown_error";
}

function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as unknown;
}

export function summarizeChapterDecisionGenerationFailures(
  failures: ChapterDecisionGenerationFailure[],
) {
  return failures.map((failure) =>
    [
      `attempt=${failure.attempt}`,
      `errorType=${failure.errorType}`,
      `message=${failure.message}`,
      failure.outputLength === undefined ? "" : `outputLength=${failure.outputLength}`,
      failure.finishReason === undefined ? "" : `finishReason=${failure.finishReason ?? "unknown"}`,
      failure.rawPreview ? `rawPreview=${failure.rawPreview}` : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
}

export async function generateChapterDecision(
  promptInput: ChapterDecisionPromptInput,
): Promise<ChapterDecisionGenerationResult> {
  const failures: ChapterDecisionGenerationFailure[] = [];

  for (let attempt = 1; attempt <= CHAPTER_DECISION_GENERATION_ATTEMPTS; attempt += 1) {
    let result: Awaited<ReturnType<typeof generateDeepSeekJson>>;

    try {
      result = await generateDeepSeekJson({
        systemPrompt: CHAPTER_DECISION_SYSTEM_PROMPT,
        userPrompt: buildChapterDecisionPrompt(promptInput),
        maxTokens: CHAPTER_DECISION_MAX_TOKENS,
        temperature: CHAPTER_DECISION_TEMPERATURE,
      });
    } catch (error) {
      failures.push({
        attempt,
        errorType: getErrorType(error),
        message: getErrorMessage(error).slice(0, 800),
      });
      continue;
    }

    let parsed: unknown;

    try {
      parsed = parseJsonObject(result.outputText);
    } catch (error) {
      failures.push({
        attempt,
        errorType: getErrorType(error),
        message: getErrorMessage(error).slice(0, 800),
        outputLength: result.outputText.length,
        finishReason: result.finishReason ?? null,
        rawPreview: result.outputText.slice(0, RAW_PREVIEW_LENGTH),
      });
      continue;
    }

    const validation = validateChapterDecisionOutput(parsed);

    if (validation.ok) {
      return {
        ok: true,
        decision: validation.decision,
        failures,
      };
    }

    failures.push({
      attempt,
      errorType: "schema_validation",
      message: validation.error,
      outputLength: result.outputText.length,
      finishReason: result.finishReason ?? null,
      rawPreview: result.outputText.slice(0, RAW_PREVIEW_LENGTH),
    });
  }

  return {
    ok: false,
    error: "DeepSeek 剧情选择生成失败：AI 输出不是有效 JSON 或未通过 schema。",
    failures,
  };
}

export function buildChapterDecisionGenerationLogError(
  result: Extract<ChapterDecisionGenerationResult, { ok: false }>,
) {
  return [
    result.error,
    ...summarizeChapterDecisionGenerationFailures(result.failures),
  ].join("\n");
}

export function buildChapterDecisionGenerationMetadata({
  error,
  source,
}: {
  error?: string;
  source: "auto-chapter-generation" | "manual-regeneration";
}) {
  return {
    status: error ? "failed" as const : "success" as const,
    source,
    promptVersion: CHAPTER_DECISION_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    ...(error ? { error: error.slice(0, 300) } : {}),
  };
}
