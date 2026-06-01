import OpenAI from "openai";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

type GenerateDeepSeekJsonOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

export function getDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}

function getDeepSeekBaseURL() {
  return process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL;
}

function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。");
  }

  return new OpenAI({
    apiKey,
    baseURL: getDeepSeekBaseURL(),
  });
}

export async function generateDeepSeekJson({
  systemPrompt,
  userPrompt,
  maxTokens = 1800,
  temperature,
}: GenerateDeepSeekJsonOptions) {
  const model = getDeepSeekModel();
  const completion = await createDeepSeekClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    ...(temperature === undefined ? {} : { temperature }),
  });

  const choice = completion.choices[0];
  const outputText = choice?.message?.content?.trim() ?? "";

  return {
    model,
    outputText,
    finishReason: choice?.finish_reason ?? null,
  };
}
