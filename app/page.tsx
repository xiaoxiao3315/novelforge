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
import { DirectorConsole } from "@/components/ui/director-console";
import { createClient } from "@/lib/supabase/server";

const modes = [
  {
    title: "经典小说模式",
    spine: "CLASSIC",
    badge: "线性长篇",
    description: "适合稳定连载，从灵感开始铺开设定、大纲和章节正文。",
    points: ["稳定推进章节", "保留版本与正式稿", "用导演指令微调单章"],
  },
  {
    title: "互动剧情模式",
    spine: "INTERACTIVE",
    badge: "实验分支",
    description: "适合进入故事、读完章节后做出选择，让故事记住你的决定。",
    points: ["命运分歧", "状态变化", "故事会记住决定"],
  },
];

const features = [
  {
    title: "剧情筛选器",
    description: "用题材、背景、主角、冲突和连载结构先锁定作品方向。",
  },
  {
    title: "故事生成",
    description: "铺开设定、故事圣经、角色卡、章节脉络和正文。",
  },
  {
    title: "AI 导演指令",
    description: "在章节阶段干预情绪、冲突、伏笔、爽点和结尾钩子。",
  },
  {
    title: "章节摘要与连续性",
    description: "沉淀关键事件、关系变化、线索和下一章上下文。",
  },
  {
    title: "版本与正式稿",
    description: "多次生成保留版本，满意后再确认正式稿。",
  },
  {
    title: "星火补给",
    description: "星火用于驱动 AI 生成故事内容；当前补给包和 mock 支付仅用于测试闭环。",
  },
];

const creationSteps = [
  "写下灵感",
  "生成设定",
  "搭建圣经",
  "展开大纲",
  "导演章节",
  "确认文本",
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = Boolean(user);
  const primaryHref = isAuthed ? "/dashboard" : "/login?redirectTo=/dashboard";
  const primaryLabel = isAuthed ? "继续上次的命运" : "开始我的故事";
  const secondaryHref = isAuthed ? "/create" : "/login?redirectTo=/create";
  const secondaryLabel = isAuthed ? "开启新故事" : "开启第一段命运";

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed={isAuthed} />

      <section className="grid min-h-[calc(100vh-140px)] items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">v0.1 Beta</StatusBookmark>
            <BookBadge tone="ink">内测中的互动故事书房</BookBadge>
          </div>

          <p className="mt-10 text-sm font-black uppercase text-[var(--gold-strong)]">
            NovelForge / 小说工坊
          </p>
          <h1 className="mt-4 font-serif text-5xl font-black leading-tight text-[var(--ink)] md:text-6xl">
            进入一段会记住你选择的故事
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-9 text-[var(--muted)]">
            读完章节，做出选择，角色关系与命运会随之改变。NovelForge 不是替你一次性写完小说，
            而是让你进入故事、推动剧情、确认自己的命运。
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
          <div className="absolute -left-4 top-8 hidden h-[82%] w-7 rounded-l-md bg-[var(--brown)] shadow-xl lg:block" />
          <div className="grid gap-4 rounded-lg border border-[var(--line-strong)] bg-[var(--paper-deep)] p-4 shadow-[var(--shadow-book)] md:grid-cols-[1fr_230px]">
            <ReaderPage
              className="max-w-none"
              footer={<span>Draft v3 / 可确认正式稿</span>}
              title={
                <div className="flex items-center justify-between gap-3">
                  <span>第一章 雾城来信</span>
                  <BookBadge tone="gold">正在创作</BookBadge>
                </div>
              }
            >
              <p>
                雨水敲在旧书店的玻璃上，像有人在门外急促地翻页。林岚拆开那封没有署名的信，
                纸面浮出一行金色小字：今晚之后，你将记得另一个结局。
              </p>
              <p className="mt-5">
                她抬头时，街灯一盏盏熄灭。柜台后的铜铃没有响，书架深处却传来一声轻笑。
              </p>
            </ReaderPage>

            <DirectorConsole
              className="min-h-full"
              defaultOpen
              eyebrow="Director Notes"
              title="AI 导演批注"
            >
              <div className="space-y-4 text-sm leading-6 text-[var(--ink-soft)]">
                <div>
                  <p className="font-black text-[var(--ink)]">本章指令</p>
                  <p className="mt-1 text-[var(--muted)]">
                    增加悬疑感，但不要提前揭露寄信人身份。
                  </p>
                </div>
                <div>
                  <p className="font-black text-[var(--ink)]">必须出现</p>
                  <p className="mt-1 text-[var(--muted)]">旧书店、金色小字、失控的街灯。</p>
                </div>
                <BookBadge tone="warning">进入本章 · 消耗星火</BookBadge>
              </div>
            </DirectorConsole>
          </div>
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
        <PaperPanel className="p-6">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
                From Spark To Chapter
              </p>
              <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
                从灵感到章节
              </h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">
                不是后台流程清单，而是一张创作桌：先定方向，再让 AI 生成可被你继续导演的文本。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {creationSteps.map((step, index) => (
                <div
                  className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4"
                  key={step}
                >
                  <p className="text-xs font-black text-[var(--gold-strong)]">
                    Chapter Desk {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-serif text-xl font-black text-[var(--ink)]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </PaperPanel>
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
