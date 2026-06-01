import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditPackagePanel } from "@/components/account/credit-package-panel";
import { MockPaymentActions } from "@/components/account/mock-payment-actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  GENERATION_CREDIT_COSTS,
  ensureCreditAccount,
  type GenerationCreditOperation,
} from "@/lib/credits";
import { isMockPaymentEnabled } from "@/lib/payments/mock";
import { CREDIT_ORDER_STATUS_LABELS } from "@/lib/payments/order-status";
import { CREDIT_PACKAGES } from "@/lib/payments/packages";
import type { CreditOrderStatus } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

type CreditTransactionRow = {
  id: string;
  operation: string;
  amount: number;
  balance_after: number;
  reason: string;
  status: string;
  created_at: string;
};

type CreditOrderRow = {
  id: string;
  order_no: string;
  package_name: string;
  credits_amount: number;
  status: CreditOrderStatus;
  credit_transaction_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

const operationLabels: Record<GenerationCreditOperation, string> = {
  generate_concept: "生成作品设定",
  generate_bible: "生成故事圣经",
  generate_outline: "生成章节大纲",
  generate_chapter: "生成章节正文",
  generate_chapter_summary: "章节摘要",
  set_official: "设为正式稿",
};

const packageLabels = Object.fromEntries(
  CREDIT_PACKAGES.map((item) => [item.packageId, item.packageName]),
) as Record<string, string>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account/credits");
  }

  const creditAccount = await ensureCreditAccount(supabase);
  const balance = creditAccount.ok ? creditAccount.balance : null;
  const mockPaymentEnabled = isMockPaymentEnabled();
  const { data: transactions, error: transactionsError } = await supabase
    .from("credit_transactions")
    .select("id,operation,amount,balance_after,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<CreditTransactionRow[]>();
  const { data: orders, error: ordersError } = await supabase
    .from("credit_orders")
    .select("id,order_no,package_name,credits_amount,status,credit_transaction_id,paid_at,cancelled_at,created_at")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<CreditOrderRow[]>();

  return (
    <main className="app-shell py-8">
      <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/dashboard" className="text-xl font-black">
          NovelForge / 小说工坊
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="button-secondary" href="/dashboard">
            返回工作台
          </Link>
          <SignOutButton />
        </div>
      </nav>

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          credits
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-[var(--ink)]">生成点数</h1>
            <p className="mt-3 text-[var(--muted)]">
              点数只用于大模型生成能力，查看内容、确认正式稿和摘要记录不额外扣点。
            </p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-white px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              当前余额
            </p>
            <p className="mt-1 text-3xl font-black text-[var(--accent-strong)]">
              {balance ?? "读取失败"} 点
            </p>
          </div>
        </div>
      </section>

      <section className="surface mt-8 p-6">
        <h2 className="text-2xl font-black text-[var(--ink)]">生成消耗</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(GENERATION_CREDIT_COSTS).map(([operation, cost]) => (
            <div
              className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
              key={operation}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {operation}
              </p>
              <p className="mt-1 font-bold text-[var(--ink)]">
                {operationLabels[operation as GenerationCreditOperation]}
              </p>
              <p className="mt-2 text-lg font-black text-[var(--accent-strong)]">{cost} 点</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">点数包占位</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              小额充值即将开放。未来可购买生成点数。
            </p>
          </div>
          <span className="rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-bold text-[#7f2f1d]">
            暂不可购买
          </span>
        </div>
        <CreditPackagePanel packages={CREDIT_PACKAGES} mockPaymentEnabled={mockPaymentEnabled} />
      </section>

      <section className="surface mt-6 p-6">
        <h2 className="text-2xl font-black text-[var(--ink)]">订单占位记录</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          这里记录测试订单状态。支付尚未接入真实网关，Mock 支付仅用于本地验收。
        </p>
        {ordersError ? (
          <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
            读取订单失败：{ordersError.message}
          </p>
        ) : orders && orders.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {orders.map((order) => (
              <div
                className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
                key={order.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--ink)]">{order.order_no}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {packageLabels[order.package_name] ?? order.package_name} ·{" "}
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[var(--accent-strong)]">
                      {order.credits_amount} 点
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {CREDIT_ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                </div>
                {order.status === "paid" ? (
                  <p className="mt-3 rounded-md bg-[#eef4f2] px-3 py-2 text-sm font-bold text-[var(--accent-strong)]">
                    已入账
                    {order.credit_transaction_id
                      ? ` · 流水 ${order.credit_transaction_id.slice(0, 8)}`
                      : ""}
                  </p>
                ) : null}
                {order.status === "failed" ? (
                  <p className="mt-3 rounded-md bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#7f2f1d]">
                    支付失败，未增加余额。
                  </p>
                ) : null}
                {order.status === "cancelled" ? (
                  <p className="mt-3 rounded-md bg-[#f7efe6] px-3 py-2 text-sm font-bold text-[#80522f]">
                    已取消，未增加余额。
                  </p>
                ) : null}
                {mockPaymentEnabled && order.status === "pending" ? (
                  <MockPaymentActions orderId={order.id} orderNo={order.order_no} />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
            <p className="font-bold text-[var(--ink)]">还没有占位订单</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              点击点数包会创建 pending 订单，但不会充值。
            </p>
          </div>
        )}
      </section>

      <section className="surface mt-6 p-6">
        <h2 className="text-2xl font-black text-[var(--ink)]">最近点数流水</h2>
        {transactionsError ? (
          <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
            读取交易记录失败：{transactionsError.message}
          </p>
        ) : transactions && transactions.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {transactions.map((transaction) => (
              <div
                className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
                key={transaction.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--ink)]">{transaction.reason}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {transaction.operation} · {formatDate(transaction.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[#7f2f1d]">{transaction.amount} 点</p>
                    <p className="text-xs text-[var(--muted)]">
                      余额 {transaction.balance_after} 点
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
            <p className="font-bold text-[var(--ink)]">还没有点数流水</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              生成成功后，扣点记录会按时间倒序显示在这里。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
