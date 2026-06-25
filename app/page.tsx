import Link from "next/link";
import { AppNav } from "@/components/app/app-nav";
import {
  BookBadge,
  BookCard,
  PaperPanel,
  ReaderPage,
  SectionTabs,
  StatusBookmark,
} from "@/components/ui/book";
import { hasInternalSession } from "@/lib/internal/auth";

const modes = [
  {
    title: "经典小说模式",
    spine: "CLASSIC",
    badge: "线性长篇",
    description: "适合从灵感开始，逐步生成作品设定、故事圣经、卷纲、章节大纲和单章正文。",
    points: ["稳定推进章节", "保留版本与正式稿", "用导演指令微调单章"],
  },
  {
    title: "互动剧情模式",
    spine: "INTERACTIVE",
    badge: "实验分支",
    description: "适合读完章节后做选择，让关系、线索和风险在下一章继续发酵。",
    points: ["命运分歧", "状态变化", "互动结果沉淀"],
  },
];

const features = [
  {
    title: "进入故事",
    description: "从一本故事开始阅读，而不是从后台表单开始操作。",
  },
  {
    title: "做出选择",
    description: "读完章节后选择下一条命运，让关系、风险和线索发生变化。",
  },
  {
    title: "故事记住你",
    description: "下一章会继承你的选择与故事状态；星火补给仍只是测试闭环。",
  },
];

export default async function HomePage() {
  const isAuthed = await hasInternalSession();

  const primaryHref = isAuthed ? "/dashboard" : "/login?redirectTo=/dashboard";
  const primaryLabel = isAuthed ? "继续上次的命运" : "开始我的故事";
  const secondaryHref = isAuthed ? "/create" : "/login?redirectTo=/create";
  const secondaryLabel = isAuthed ? "开启新故事" : "开启第一本书";

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed={isAuthed} />

      <section className="grid min-h-[calc(100vh-140px)] items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">v0.1 Beta</StatusBookmark>
            <BookBadge tone="ink">互动故事内测</BookBadge>
          </div>

          <p className="mt-10 text-sm font-black uppercase text-[var(--gold-strong)]">
            NovelForge / 小说工坊
          </p>
          <h1 className="mt-4 font-serif text-5xl font-black leading-tight text-[var(--ink)] md:text-6xl">
            进入一段会记住你选择的故事
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-9 text-[var(--muted)]">
            读完章节，做出选择，角色关系与命运会随之改变。你也可以保留经典小说模式，
            稳定生成设定、大纲和章节正文。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href={primaryHref}>
              {primaryLabel}
            </Link>
            <Link className="button-secondary" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            当前为内测版：AI 输出仍需人工判断和调整；真实支付尚未接入，星火补给与
            mock 支付仅用于本地或测试环境验收。
          </p>
        </div>

        <div className="relative">
          <PaperPanel className="home-story-preview p-5">
            <ReaderPage
              className="max-w-none"
              footer={<span>阅读 → 选择 → 命运改变 → 继续</span>}
              title={
                <div className="flex items-center justify-between gap-3">
                  <span>第一章 雾城来信</span>
                  <BookBadge tone="warning">命运分歧</BookBadge>
                </div>
              }
            >
              <p>
                雨水敲在旧书店的玻璃上。林岚拆开那封没有署名的信，纸面浮出一行金色小字：
                今晚之后，你将记得另一个结局。
              </p>
              <div className="mt-6 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.74)] p-4">
                <p className="font-serif text-xl font-black text-[var(--ink)]">读完之后，选一条路</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  留在书店寻找寄信人，或追进雨夜。故事会记住这次决定。
                </p>
              </div>
            </ReaderPage>
          </PaperPanel>
        </div>
      </section>

      <section className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
              Writing Modes
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
              选择你的小说形态
            </h2>
          </div>
          <SectionTabs
            activeId="classic"
            tabs={[
              { id: "classic", label: "经典模式" },
              { id: "interactive", label: "互动模式" },
            ]}
          />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {modes.map((mode) => (
            <BookCard key={mode.title} spine={mode.spine}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <BookBadge tone="gold">{mode.badge}</BookBadge>
                  <h3 className="mt-4 font-serif text-2xl font-black text-[var(--ink)]">
                    {mode.title}
                  </h3>
                </div>
              </div>
              <p className="mt-3 leading-7 text-[var(--muted)]">{mode.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {mode.points.map((point) => (
                  <BookBadge key={point} tone="paper">
                    {point}
                  </BookBadge>
                ))}
              </div>
            </BookCard>
          ))}
        </div>
      </section>

      <section className="py-10">
        <div className="mb-6">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
            Studio Tools
          </p>
          <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
            书页背后的创作工具
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <PaperPanel className="p-5" key={feature.title}>
              <h3 className="font-serif text-xl font-black text-[var(--ink)]">
                {feature.title}
              </h3>
              <p className="mt-3 leading-7 text-[var(--muted)]">{feature.description}</p>
            </PaperPanel>
          ))}
        </div>
      </section>
    </main>
  );
}
