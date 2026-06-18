import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { CreateProjectForm } from "@/components/project/create-project-form";
import { BookBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { ensureCreditAccount } from "@/lib/credits";
import { hasInternalSession } from "@/lib/internal/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "开启新故事",
};

export default async function CreateProjectPage() {
  const internalSession = await hasInternalSession();

  if (internalSession) {
    return (
      <main className="app-shell py-8">
        <AppNav isAuthed creditBalance={9999} />

        <section className="create-hero mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBookmark tone="gold">Internal Mode</StatusBookmark>
              <BookBadge tone="ink">创作入口</BookBadge>
            </div>
            <h1 className="mt-10 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
              开启一本新故事
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
              内部单机模式会把项目保存到服务器本地文件，不再使用 Supabase Auth。
            </p>
          </div>

          <PaperPanel className="p-5">
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">Internal</p>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
              创建项目不会消耗真实点数。生成仍使用服务器上的 DeepSeek 配置。
            </p>
          </PaperPanel>
        </section>

        <section className="mt-8">
          <CreateProjectForm />
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/create");
  }

  const creditAccount = await ensureCreditAccount(supabase);
  const creditBalance = creditAccount.ok ? creditAccount.balance : null;

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

      <section className="create-hero mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">New Story</StatusBookmark>
            <BookBadge tone="ink">创作入口</BookBadge>
          </div>
          <p className="mt-10 text-sm font-black uppercase text-[var(--gold-strong)]">
            Story Gate
          </p>
          <h1 className="mt-2 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            开启一本新故事
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
            先选一条命运的起点。告诉 NovelForge，你想进入怎样的世界、谁会站在故事中央，
            以及这段旅程该带来怎样的阅读情绪。
          </p>
        </div>

        <PaperPanel className="p-5">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">Before You Begin</p>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--muted)]">
            <p>创建只保存故事起点，不触发 AI 生成，也不消耗星火。</p>
            <p>进入项目页后，再继续生成设定、故事圣经、大纲和章节正文。</p>
          </div>
        </PaperPanel>
      </section>

      <section className="mt-8">
        <CreateProjectForm />
      </section>
    </main>
  );
}
