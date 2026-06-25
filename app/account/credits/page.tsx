import { AppNav } from "@/components/app/app-nav";
import {
  BookBadge,
  BookCard,
  CreditBadge,
  PaperPanel,
  StatusBookmark,
} from "@/components/ui/book";
import {
  GENERATION_CREDIT_COSTS,
  type GenerationCreditOperation,
} from "@/lib/credits";

export const metadata = {
  title: "星火补给",
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

export default async function CreditsPage() {
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
            当前运行在内部单用户模式，不接入账户、订单或真实支付。生成流程使用固定额度显示。
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
            这个数字只用于内部界面显示，不会产生订单流水。
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
            当前版本用于内部访问，登录后即可创建项目并生成内容；补给包、支付和订单记录均不启用。
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
