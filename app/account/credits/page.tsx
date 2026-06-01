import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  GENERATION_CREDIT_COSTS,
  ensureCreditAccount,
  type GenerationCreditOperation,
} from "@/lib/credits";
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

const operationLabels: Record<GenerationCreditOperation, string> = {
  generate_concept: "生成作品设定",
  generate_bible: "生成故事圣经",
  generate_outline: "生成章节大纲",
  generate_chapter: "生成章节正文",
  generate_chapter_summary: "章节摘要",
  set_official: "设为正式稿",
};

const creditPackages = [
  { points: 30, label: "轻量补给" },
  { points: 100, label: "连载常用" },
  { points: 300, label: "长篇储备" },
];

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
  const { data: transactions, error: transactionsError } = await supabase
    .from("credit_transactions")
    .select("id,operation,amount,balance_after,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<CreditTransactionRow[]>();

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
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {creditPackages.map((item) => (
            <div
              className="rounded-md border border-dashed border-[var(--line)] bg-white/70 px-4 py-4"
              key={item.points}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--ink)]">{item.points} 点</p>
              <button className="button-secondary mt-4 w-full opacity-60" disabled type="button">
                小额充值即将开放
              </button>
            </div>
          ))}
        </div>
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
