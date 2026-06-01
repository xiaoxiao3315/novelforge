export function formatUserFacingError(error: string | undefined, fallback: string) {
  if (!error) {
    return fallback;
  }

  if (error.includes("点数不足")) {
    return error;
  }

  if (error.includes("请先") || error.includes("缺少") || error.includes("需要先")) {
    return error;
  }

  if (error.includes("JSON") || error.includes("parse") || error.includes("schema")) {
    return "AI 返回内容解析失败，系统已保留旧数据。请稍后重试一次。";
  }

  if (error.includes("DeepSeek") || error.includes("AI") || error.includes("fetch")) {
    return "AI 服务暂时不可用，可能是模型响应超时或网络波动。请稍后重试。";
  }

  if (
    error.includes("duplicate key") ||
    error.includes("violates") ||
    error.includes("PGRST") ||
    error.includes("JWT") ||
    error.includes("invalid input syntax") ||
    error.length > 140
  ) {
    return fallback;
  }

  return error;
}
