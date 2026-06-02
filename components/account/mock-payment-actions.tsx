"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge } from "@/components/ui/book";
import { formatUserFacingError } from "@/lib/ui/errors";

type MockPaymentResult = "success" | "failed" | "cancelled";

type MockPaymentActionsProps = {
  orderId: string;
  orderNo: string;
};

type MockCompleteResponse = {
  message?: string;
  error?: string;
  balanceAfter?: number | null;
};

const resultLabels: Record<MockPaymentResult, string> = {
  success: "模拟成功入账",
  failed: "模拟支付失败",
  cancelled: "模拟取消支付",
};

export function MockPaymentActions({ orderId, orderNo }: MockPaymentActionsProps) {
  const [pendingResult, setPendingResult] = useState<MockPaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function completeMockPayment(result: MockPaymentResult) {
    if (pendingResult) {
      return;
    }

    setMessage("");
    setPendingResult(result);

    try {
      const response = await fetch("/api/credits/orders/mock-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, orderNo, result }),
      });
      const payload = (await response.json().catch(() => null)) as MockCompleteResponse | null;

      if (!response.ok) {
        setMessage(formatUserFacingError(payload?.error, "Mock 支付处理失败，请稍后重试。"));
        return;
      }

      setMessage(payload?.message || "Mock 支付状态已更新。");
      router.refresh();
    } catch {
      setMessage("Mock 支付处理失败，请检查网络后重试。");
    } finally {
      setPendingResult(null);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-dashed border-[rgba(138,58,33,0.38)] bg-[rgba(138,58,33,0.07)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookBadge tone="warning">Mock 支付，仅测试</BookBadge>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            真实支付尚未接入。这里仅用于验证 pending / paid / failed / cancelled 状态流转。
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(resultLabels) as MockPaymentResult[]).map((result) => (
          <button
            className="button-secondary min-h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(pendingResult)}
            key={result}
            onClick={() => completeMockPayment(result)}
            type="button"
          >
            {pendingResult === result ? "处理中..." : resultLabels[result]}
          </button>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-[var(--warning)]">{message}</p> : null}
    </div>
  );
}
