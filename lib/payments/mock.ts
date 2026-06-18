export type MockPaymentResult = "success" | "failed" | "cancelled";

export const MOCK_PAYMENT_RESULTS = ["success", "failed", "cancelled"] as const;

export function isMockPaymentEnabled() {
  // 双重开关：必须显式设置 ENABLE_MOCK_PAYMENTS=true，且不允许在生产环境开启。
  // 防止预发/误配置环境被登录用户用来 mock 入账。
  return (
    process.env.ENABLE_MOCK_PAYMENTS === "true" && process.env.NODE_ENV !== "production"
  );
}

export function isMockPaymentResult(value: unknown): value is MockPaymentResult {
  return MOCK_PAYMENT_RESULTS.includes(value as MockPaymentResult);
}
