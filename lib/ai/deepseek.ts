import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_RETRY_ATTEMPTS = 2;
const DEFAULT_DEEPSEEK_RETRY_BASE_DELAY_MS = 1200;
const DEFAULT_DEEPSEEK_TIMEOUT_MS = 120_000;

type GenerateDeepSeekJsonOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

type GenerateDeepSeekTextOptions = GenerateDeepSeekJsonOptions;

type DeepSeekCompletionResult = ChatCompletion;

export function getDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}

function getDeepSeekBaseURL() {
  return process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getDeepSeekRetryAttempts() {
  return readPositiveIntegerEnv("DEEPSEEK_RETRY_ATTEMPTS", DEFAULT_DEEPSEEK_RETRY_ATTEMPTS);
}

function getDeepSeekRetryBaseDelayMs() {
  return readPositiveIntegerEnv(
    "DEEPSEEK_RETRY_BASE_DELAY_MS",
    DEFAULT_DEEPSEEK_RETRY_BASE_DELAY_MS,
  );
}

function getDeepSeekTimeoutMs() {
  return readPositiveIntegerEnv("DEEPSEEK_TIMEOUT_MS", DEFAULT_DEEPSEEK_TIMEOUT_MS);
}

function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。");
  }

  return new OpenAI({
    apiKey,
    baseURL: getDeepSeekBaseURL(),
    maxRetries: 0,
    timeout: getDeepSeekTimeoutMs(),
  });
}

function getErrorRecord(error: unknown) {
  return typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
}

function getErrorStatus(error: unknown) {
  const record = getErrorRecord(error);
  const status = record?.status;

  return typeof status === "number" ? status : null;
}

function getErrorName(error: unknown) {
  const record = getErrorRecord(error);
  const name = record?.name;

  return typeof name === "string" ? name : "";
}

function getErrorCode(error: unknown) {
  const record = getErrorRecord(error);
  const code = record?.code;

  return typeof code === "string" ? code : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTransientDeepSeekError(error: unknown) {
  const status = getErrorStatus(error);

  if (status && (status === 408 || status === 409 || status === 429 || status >= 500)) {
    return true;
  }

  const code = getErrorCode(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  const message = getErrorMessage(error).toLowerCase();

  return [
    "abort",
    "api connection",
    "api timeout",
    "connection",
    "econnreset",
    "enotfound",
    "etimedout",
    "fetch failed",
    "network",
    "socket",
    "timeout",
  ].some((needle) => code.includes(needle) || name.includes(needle) || message.includes(needle));
}

function delayDeepSeekRetry(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runDeepSeekCompletionWithRetry(
  createCompletion: () => Promise<DeepSeekCompletionResult>,
) {
  const attempts = getDeepSeekRetryAttempts();
  const baseDelayMs = getDeepSeekRetryBaseDelayMs();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await createCompletion();
    } catch (error) {
      lastError = error;

      if (!isTransientDeepSeekError(error) || attempt === attempts) {
        throw error;
      }

      await delayDeepSeekRetry(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function generateDeepSeekJson({
  systemPrompt,
  userPrompt,
  maxTokens = 1800,
  temperature,
}: GenerateDeepSeekJsonOptions) {
  const model = getDeepSeekModel();
  const completion = await runDeepSeekCompletionWithRetry(() =>
    createDeepSeekClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      ...(temperature === undefined ? {} : { temperature }),
    }),
  );

  const choice = completion.choices[0];
  const outputText = choice?.message?.content?.trim() ?? "";

  return {
    model,
    outputText,
    finishReason: choice?.finish_reason ?? null,
  };
}

export async function generateDeepSeekText({
  systemPrompt,
  userPrompt,
  maxTokens = 3000,
  temperature,
}: GenerateDeepSeekTextOptions) {
  const model = getDeepSeekModel();
  const completion = await runDeepSeekCompletionWithRetry(() =>
    createDeepSeekClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      ...(temperature === undefined ? {} : { temperature }),
    }),
  );

  const choice = completion.choices[0];
  const outputText = choice?.message?.content?.trim() ?? "";

  return {
    model,
    outputText,
    finishReason: choice?.finish_reason ?? null,
  };
}
