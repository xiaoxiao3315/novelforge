"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge, BookCard } from "@/components/ui/book";
import type { CREDIT_PACKAGES } from "@/lib/payments/packages";
import { formatUserFacingError } from "@/lib/ui/errors";

type CreditPackage = (typeof CREDIT_PACKAGES)[number];

type CreditPackagePanelProps = {
  packages: readonly CreditPackage[];
  mockPaymentEnabled: boolean;
};

type CreateOrderResponse = {
  message?: string;
  order?: {
    order_no: string;
    credits_amount: number;
    status: string;
  };
  error?: string;
};

export function CreditPackagePanel({ packages, mockPaymentEnabled }: CreditPackagePanelProps) {
  const [pendingPackageName, setPendingPackageName] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function createOrder(packageId: string) {
    if (pendingPackageName) {
      return;
    }

    setMessage("");
    setPendingPackageName(packageId);

    try {
      const response = await fetch("/api/credits/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      });

      const payload = (await response.json().catch(() => null)) as CreateOrderResponse | null;

      if (!response.ok || !payload?.order) {
        setMessage(formatUserFacingError(payload?.error, "点数订单创建失败，请稍后重试。"));
        return;
      }

      setMessage(
        `${payload.order.credits_amount} 点测试订单 ${payload.order.order_no} 已创建，可在最近订单中使用 Mock 支付验证状态流转。`,
      );
      router.refresh();
    } catch {
      setMessage("点数订单创建失败，请检查网络后重试。");
    } finally {
      setPendingPackageName("");
    }
  }

  return (
    <>
      {message ? (
        <p className="mt-5 rounded-md border border-[rgba(138,58,33,0.32)] bg-[rgba(138,58,33,0.08)] px-4 py-3 text-sm font-bold leading-6 text-[var(--warning)]">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {packages.map((item) => (
          <BookCard className="min-h-full" key={item.packageId} spine="点数券">
            <div className="flex min-h-[210px] flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <BookBadge tone="gold">创作券夹</BookBadge>
                  <h3 className="mt-4 font-serif text-2xl font-black text-[var(--ink)]">
                    {item.packageName}
                  </h3>
                </div>
                <BookBadge tone="warning">Mock</BookBadge>
              </div>

              <p className="mt-5 font-serif text-4xl font-black text-[var(--brown)]">
                {item.creditsAmount}
                <span className="ml-2 text-base font-bold text-[var(--muted)]">点</span>
              </p>

              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {mockPaymentEnabled
                  ? "Mock 支付，仅测试订单状态和入账流水。"
                  : "真实支付尚未接入，当前不能真实购买。"}
              </p>

              <button
                className="button-secondary mt-auto w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(pendingPackageName)}
                onClick={() => createOrder(item.packageId)}
                type="button"
              >
                {pendingPackageName === item.packageId ? "创建测试订单中..." : "创建测试订单"}
              </button>
            </div>
          </BookCard>
        ))}
      </div>
    </>
  );
}
