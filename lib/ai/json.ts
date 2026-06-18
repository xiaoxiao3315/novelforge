/**
 * 解析模型返回的 JSON object 文本。
 * 容忍模型偶尔包裹的 Markdown 代码块（```json ... ```）。
 */
export function parseJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as unknown;
}
