"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  success: "模拟支付成功",
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
    <div className="mt-4 rounded-md border border-dashed border-[#e2b6a6] bg-[#fffaf6] px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7f2f1d]">
        Mock 支付，仅测试
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
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
      {message ? <p className="mt-3 text-sm text-[#7f2f1d]">{message}</p> : null}
    </div>
  );
}
