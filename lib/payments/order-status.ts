import type { CreditOrderStatus } from "@/lib/payments/types";

export const CREDIT_ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refunded",
] as const satisfies readonly CreditOrderStatus[];

export const CREDIT_ORDER_STATUS_LABELS: Record<CreditOrderStatus, string> = {
  pending: "等待支付接入",
  paid: "已入账",
  failed: "支付失败",
  cancelled: "已取消",
  expired: "已过期",
  refunded: "已退款",
};

export const CREDIT_ORDER_STATUS_TRANSITIONS: Record<CreditOrderStatus, CreditOrderStatus[]> = {
  pending: ["paid", "failed", "cancelled", "expired"],
  paid: ["refunded"],
  failed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export function isCreditOrderStatus(value: string): value is CreditOrderStatus {
  return CREDIT_ORDER_STATUSES.includes(value as CreditOrderStatus);
}
