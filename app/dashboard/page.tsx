import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
import { BookBadge, CreditBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { ensureCreditAccount } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id,title,description,status,created_at,updated_at")
    .order("updated_at", { ascending: false });
  const creditAccount = await ensureCreditAccount(supabase);
  const creditBalance = creditAccount.ok ? creditAccount.balance : null;
  const projectCount = projects?.length ?? 0;

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

      <section className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">Bookshelf</StatusBookmark>
            <BookBadge tone="ink">NovelForge 书房</BookBadge>
          </div>
          <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            我的书架
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-[var(--muted)]">
            这里不是作品列表，而是你的小说书架。每一本书都保存剧情筛选器、AI 生成结果、
            章节版本和正式稿状态，随时可以继续翻开创作。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="button-primary" href="/create">
              创建新作品
            </Link>
            <Link className="button-secondary" href="/account/credits">
              查看点数钱包
            </Link>
          </div>
        </div>

        <PaperPanel className="p-5">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">Library Desk</p>
          <div className="mt-5 grid gap-4">
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">馆藏作品</p>
              <p className="mt-1 font-serif text-3xl font-black text-[var(--ink)]">
                {projectCount} 本
              </p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">当前余额</p>
              <CreditBadge balance={creditBalance} className="mt-2" label="点数" />
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">
              内测提示：真实支付尚未接入，点数包与 mock 支付仅用于测试闭环。
            </p>
          </div>
        </PaperPanel>
      </section>

      <section className="py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
              Works On The Shelf
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
              作品书架
            </h2>
          </div>
          <BookBadge tone="paper">
            旧项目未记录模式时，默认按经典小说模式显示
          </BookBadge>
        </div>

        {projectsError ? (
          <PaperPanel className="mt-6 p-5">
            <p className="font-bold text-[var(--warning)]">
              作品书架暂时读取失败，请刷新页面重试。
            </p>
          </PaperPanel>
        ) : projects && projects.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(projects as ProjectCardData[]).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <PaperPanel className="mt-6 overflow-hidden p-8 text-center">
            <div className="mx-auto flex h-28 w-20 items-center justify-center rounded-md border border-[var(--line-strong)] border-l-[6px] border-l-[var(--brown)] bg-[var(--paper)] shadow-[var(--shadow-book)]">
              <span className="font-serif text-lg font-black text-[var(--brown)]">NF</span>
            </div>
            <h3 className="mt-6 font-serif text-2xl font-black text-[var(--ink)]">
              你的书架还没有第一本书
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
              先创建一本作品，选择题材、背景、主角和核心冲突。创建后就能继续生成设定、
              故事圣经、章节大纲和正文。
            </p>
            <Link className="button-primary mt-6" href="/create">
              创建第一本书
            </Link>
          </PaperPanel>
        )}
      </section>
    </main>
  );
}
