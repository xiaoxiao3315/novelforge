export type MockPaymentResult = "success" | "failed" | "cancelled";

export const MOCK_PAYMENT_RESULTS = ["success", "failed", "cancelled"] as const;

export function isMockPaymentEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function isMockPaymentResult(value: unknown): value is MockPaymentResult {
  return MOCK_PAYMENT_RESULTS.includes(value as MockPaymentResult);
}
