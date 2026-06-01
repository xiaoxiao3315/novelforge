"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CREDIT_PACKAGES } from "@/lib/credits";

type CreditPackage = (typeof CREDIT_PACKAGES)[number];

type CreditPackagePanelProps = {
  packages: readonly CreditPackage[];
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

export function CreditPackagePanel({ packages }: CreditPackagePanelProps) {
  const [pendingPackageName, setPendingPackageName] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function createOrder(packageName: string) {
    if (pendingPackageName) {
      return;
    }

    setMessage("");
    setPendingPackageName(packageName);

    try {
      const response = await fetch("/api/credits/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageName }),
      });

      const payload = (await response.json().catch(() => null)) as CreateOrderResponse | null;

      if (!response.ok || !payload?.order) {
        setMessage(payload?.error || "点数订单创建失败，请稍后重试。");
        return;
      }

      setMessage(
        `${payload.order.credits_amount} 点订单 ${payload.order.order_no} 已创建，支付尚未接入，不会增加余额。`,
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
        <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {packages.map((item) => (
          <div
            className="rounded-md border border-dashed border-[var(--line)] bg-white/70 px-4 py-4"
            key={item.packageName}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--ink)]">
              {item.creditsAmount} 点
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">小额充值即将开放</p>
            <button
              className="button-secondary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(pendingPackageName)}
              onClick={() => createOrder(item.packageName)}
              type="button"
            >
              {pendingPackageName === item.packageName ? "创建中..." : "创建占位订单"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
