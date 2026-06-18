import { redirect } from "next/navigation";
import { CreditPackagePanel } from "@/components/account/credit-package-panel";
import { MockPaymentActions } from "@/components/account/mock-payment-actions";
import { AppNav } from "@/components/app/app-nav";
import {
  BookBadge,
  BookCard,
  CreditBadge,
  PaperPanel,
  SectionTabs,
  StatusBookmark,
} from "@/components/ui/book";
import {
  GENERATION_CREDIT_COSTS,
  ensureCreditAccount,
  type GenerationCreditOperation,
} from "@/lib/credits";
import { hasInternalSession } from "@/lib/internal/auth";
import { isMockPaymentEnabled } from "@/lib/payments/mock";
import { CREDIT_ORDER_STATUS_LABELS } from "@/lib/payments/order-status";
import { CREDIT_PACKAGES } from "@/lib/payments/packages";
import type { CreditOrderStatus } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "星火补给",
};

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
  generate_chapter_quality: "精修生成章节正文",
  claim_read_chapter: "阅读缓存章节",
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

function formatTransactionAmount(amount: number) {
  return `${amount > 0 ? "+" : ""}${amount} 星火`;
}

function getStatusTone(status: CreditOrderStatus) {
  if (status === "paid") {
    return "success" as const;
  }

  if (status === "failed" || status === "cancelled" || status === "expired") {
    return "warning" as const;
  }

  return "gold" as const;
}

export default async function CreditsPage() {
  const internalSession = await hasInternalSession();

  if (internalSession) {
    const balance = 9999;

    return (
      <main className="app-shell py-8">
        <AppNav isAuthed creditBalance={balance} />

        <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBookmark tone="gold">Internal Mode</StatusBookmark>
              <BookBadge tone="ink">本地额度</BookBadge>
            </div>
            <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
              内部创作额度
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
              当前运行在内部单用户模式，不接入 Supabase 账户、订单或真实支付。生成流程使用固定额度显示。
            </p>
          </div>

          <PaperPanel className="p-6">
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
              Internal Balance
            </p>
            <p className="mt-4 font-serif text-6xl font-black text-[var(--brown)]">
              {balance}
              <span className="ml-2 text-lg font-bold text-[var(--muted)]">额度</span>
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              这个数字只用于内部界面显示，不会写入 Supabase，也不会产生订单流水。
            </p>
            <CreditBadge balance={balance} className="mt-4" label="当前额度" />
          </PaperPanel>
        </section>

        <section className="grid gap-6 py-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PaperPanel className="p-6">
            <BookBadge tone="paper">内部模式</BookBadge>
            <h2 className="mt-4 font-serif text-3xl font-black text-[var(--ink)]">
              无需补给包
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              当前版本用于内部访问，游客登录后即可创建项目并生成内容；补给包、Mock 支付和订单记录均不启用。
            </p>
          </PaperPanel>

          <aside className="grid gap-6 xl:sticky xl:top-6">
            <details className="credits-fold" open>
              <summary>
                <div>
                  <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
                    Costs
                  </p>
                  <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
                    原始消耗规则
                  </h2>
                </div>
                <BookBadge tone="paper">参考</BookBadge>
              </summary>
              <div className="credits-fold-body grid gap-3">
                {Object.entries(GENERATION_CREDIT_COSTS).map(([operation, cost]) => (
                  <BookCard key={operation} spine="消耗">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[var(--gold-strong)]">
                          {operation}
                        </p>
                        <p className="mt-1 font-bold leading-6 text-[var(--ink)]">
                          {operationLabels[operation as GenerationCreditOperation]}
                        </p>
                      </div>
                      <BookBadge tone={cost > 0 ? "gold" : "success"}>{cost} 额度</BookBadge>
                    </div>
                  </BookCard>
                ))}
              </div>
            </details>
          </aside>
        </section>
      </main>
    );
  }

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
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<CreditTransactionRow[]>();
  const { data: orders, error: ordersError } = await supabase
    .from("credit_orders")
    .select("id,order_no,package_name,credits_amount,status,credit_transaction_id,paid_at,cancelled_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<CreditOrderRow[]>();

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={balance} />

      <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">Spark Supply</StatusBookmark>
            <BookBadge tone="ink">星火账本</BookBadge>
          </div>
          <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            星火补给
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
            星火用于驱动 AI 生成故事内容：生成设定、故事圣经、大纲和章节正文。查看内容、
            确认正式稿和摘要记录不会额外消耗。
          </p>
        </div>

        <PaperPanel className="p-6">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
            Spark Balance
          </p>
          <p className="mt-4 font-serif text-6xl font-black text-[var(--brown)]">
            {balance ?? "--"}
            <span className="ml-2 text-lg font-bold text-[var(--muted)]">星火</span>
          </p>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            余额读取自现有账户；生成成功后消耗星火，失败不消耗。
          </p>
          <CreditBadge balance={balance} className="mt-4" label="当前星火" />
        </PaperPanel>
      </section>

      <PaperPanel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BookBadge tone="warning">Mock 支付，仅测试</BookBadge>
            <h2 className="mt-4 font-serif text-2xl font-black text-[var(--ink)]">
              真实支付尚未接入
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              当前不会接入 Stripe、微信支付、支付宝或真实 checkout。星火补给只创建测试订单，
              用于验证订单状态、入账流水和幂等逻辑。
            </p>
          </div>
          <BookBadge tone={mockPaymentEnabled ? "gold" : "paper"}>
            {mockPaymentEnabled ? "Mock completion 可用" : "Mock completion 不可用"}
          </BookBadge>
        </div>
      </PaperPanel>

      <section className="grid gap-6 py-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <PaperPanel className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
                  Spark Packs
                </p>
                <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
                  补给包
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  这些是测试用星火补给包。点击后只会创建 pending 测试订单，不会真实扣款。
                </p>
              </div>
              <BookBadge tone="warning">暂不支持真实购买</BookBadge>
            </div>
            <CreditPackagePanel packages={CREDIT_PACKAGES} mockPaymentEnabled={mockPaymentEnabled} />
          </PaperPanel>

          <details className="credits-fold">
            <summary>
              <div>
                <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
                  Spark Ledger
                </p>
                <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
                  星火账本
                </h2>
              </div>
              <SectionTabs
                activeId="orders"
                tabs={[
                  { id: "orders", label: "最近订单" },
                  { id: "transactions", label: "星火流水" },
                ]}
              />
            </summary>

            <div className="credits-fold-body grid gap-6 xl:grid-cols-2">
              <section>
                <h3 className="font-serif text-xl font-black text-[var(--ink)]">最近订单</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  记录测试订单状态。pending 订单可使用 Mock 支付按钮验证状态变化。
                </p>
                {ordersError ? (
                  <p className="mt-4 rounded-md border border-[rgba(138,58,33,0.32)] bg-[rgba(138,58,33,0.08)] px-4 py-3 text-sm font-bold text-[var(--warning)]">
                    订单记录暂时读取失败，请刷新页面重试。
                  </p>
                ) : orders && orders.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {orders.map((order) => (
                      <article
                        className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-4 py-4"
                        key={order.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[var(--ink)]">{order.order_no}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {packageLabels[order.package_name] ?? order.package_name} ·{" "}
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-serif text-2xl font-black text-[var(--brown)]">
                              {order.credits_amount}
                              <span className="ml-1 text-sm text-[var(--muted)]">星火</span>
                            </p>
                            <BookBadge tone={getStatusTone(order.status)}>
                              {CREDIT_ORDER_STATUS_LABELS[order.status] ?? order.status}
                            </BookBadge>
                          </div>
                        </div>

                        {order.status === "paid" ? (
                          <p className="mt-3 rounded-md border border-[rgba(73,106,66,0.24)] bg-[rgba(73,106,66,0.1)] px-3 py-2 text-sm font-bold text-[var(--success)]">
                            已入账
                            {order.credit_transaction_id
                              ? ` · 流水 ${order.credit_transaction_id.slice(0, 8)}`
                              : ""}
                          </p>
                        ) : null}
                        {order.status === "failed" ? (
                          <p className="mt-3 rounded-md border border-[rgba(138,58,33,0.28)] bg-[rgba(138,58,33,0.08)] px-3 py-2 text-sm font-bold text-[var(--warning)]">
                            支付失败，未增加余额。
                          </p>
                        ) : null}
                        {order.status === "cancelled" ? (
                          <p className="mt-3 rounded-md border border-[rgba(138,58,33,0.22)] bg-[rgba(138,58,33,0.06)] px-3 py-2 text-sm font-bold text-[var(--warning)]">
                            已取消，未增加余额。
                          </p>
                        ) : null}
                        {mockPaymentEnabled && order.status === "pending" ? (
                          <MockPaymentActions orderId={order.id} orderNo={order.order_no} />
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-6 text-center">
                    <p className="font-bold text-[var(--ink)]">还没有测试订单</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      创建星火补给测试订单后，会在这里显示 pending 状态。
                    </p>
                  </div>
                )}
              </section>

              <section>
                <h3 className="font-serif text-xl font-black text-[var(--ink)]">星火流水</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  像账本一样记录生成消耗、测试入账和余额变化。
                </p>
                {transactionsError ? (
                  <p className="mt-4 rounded-md border border-[rgba(138,58,33,0.32)] bg-[rgba(138,58,33,0.08)] px-4 py-3 text-sm font-bold text-[var(--warning)]">
                    星火流水暂时读取失败，请刷新页面重试。
                  </p>
                ) : transactions && transactions.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {transactions.map((transaction) => (
                      <article
                        className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-4 py-4"
                        key={transaction.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[var(--ink)]">{transaction.reason}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {transaction.operation} · {formatDate(transaction.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={
                                transaction.amount > 0
                                  ? "text-lg font-black text-[var(--success)]"
                                  : "text-lg font-black text-[var(--warning)]"
                              }
                            >
                              {formatTransactionAmount(transaction.amount)}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              余额 {transaction.balance_after} 星火
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-6 text-center">
                    <p className="font-bold text-[var(--ink)]">还没有星火流水</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      生成成功或测试入账后，流水会按时间倒序显示。
                    </p>
                  </div>
                )}
              </section>
            </div>
          </details>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-6">
          <details className="credits-fold">
            <summary>
              <div>
                <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
                  Spark Costs
                </p>
                <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
                  消耗规则
                </h2>
              </div>
              <BookBadge tone="paper">展开</BookBadge>
            </summary>
            <div className="credits-fold-body grid gap-3">
              {Object.entries(GENERATION_CREDIT_COSTS).map(([operation, cost]) => (
                <BookCard key={operation} spine="消耗">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-[var(--gold-strong)]">
                        {operation}
                      </p>
                      <p className="mt-1 font-bold leading-6 text-[var(--ink)]">
                        {operationLabels[operation as GenerationCreditOperation]}
                      </p>
                    </div>
                    <BookBadge tone={cost > 0 ? "gold" : "success"}>{cost} 星火</BookBadge>
                  </div>
                </BookCard>
              ))}
            </div>
          </details>
        </aside>
      </section>
    </main>
  );
}
