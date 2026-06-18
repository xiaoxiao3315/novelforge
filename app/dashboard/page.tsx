import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
import { BookBadge, CreditBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { ensureCreditAccount } from "@/lib/credits";
import {
  getProjectModeFromConfig,
  type ProjectMode,
} from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "我的故事",
};

type ProjectRow = Omit<ProjectCardData, "mode">;

type StoryConfigModeRow = {
  project_id: string;
  config_json: unknown;
};

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
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);
  const { data: storyConfigRows } =
    projectIds.length > 0
      ? await supabase
          .from("story_configs")
          .select("project_id,config_json")
          .in("project_id", projectIds)
          .returns<StoryConfigModeRow[]>()
      : { data: [] as StoryConfigModeRow[] };
  const modeByProjectId = new Map<string, ProjectMode>(
    (storyConfigRows ?? []).map((row) => [
      row.project_id,
      getProjectModeFromConfig(row.config_json),
    ]),
  );
  const projectCards: ProjectCardData[] = projectRows.map((project) => ({
    ...project,
    mode: modeByProjectId.get(project.id) ?? "classic",
  }));
  const creditAccount = await ensureCreditAccount(supabase);
  const creditBalance = creditAccount.ok ? creditAccount.balance : null;
  const projectCount = projects?.length ?? 0;

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

      <section className="dashboard-hero grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">Story Shelf</StatusBookmark>
            <BookBadge tone="ink">故事存档</BookBadge>
          </div>
          <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            我的故事
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-[var(--muted)]">
            选择一本故事，继续你上次留下的命运。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="button-primary" href="/create">
              开启新故事
            </Link>
            <Link className="button-secondary" href="/account/credits">
              查看星火补给
            </Link>
          </div>
        </div>

        <PaperPanel className="p-5">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">Archive Desk</p>
          <div className="mt-5 grid gap-4">
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">当前故事</p>
              <p className="mt-1 font-serif text-3xl font-black text-[var(--ink)]">
                {projectCount} 本
              </p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">当前星火</p>
              <CreditBadge balance={creditBalance} className="mt-2" label="星火" />
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">
              内测：星火补给与 mock 支付仅用于测试闭环。
            </p>
          </div>
        </PaperPanel>
      </section>

      <section className="py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
              Saved Stories
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">
              故事存档
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
        ) : projectCards.length > 0 ? (
          <div className="story-shelf-grid mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projectCards.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <PaperPanel className="mt-6 overflow-hidden p-8 text-center">
            <div className="mx-auto flex h-28 w-20 items-center justify-center rounded-md border border-[var(--line-strong)] border-l-[6px] border-l-[var(--brown)] bg-[var(--paper)] shadow-[var(--shadow-book)]">
              <span className="font-serif text-lg font-black text-[var(--brown)]">NF</span>
            </div>
            <h3 className="mt-6 font-serif text-2xl font-black text-[var(--ink)]">
              你的故事还没有开始
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
              创建第一本小说，选择题材、背景、主角和核心冲突，让它成为可以继续翻开的故事存档。
            </p>
            <Link className="button-primary mt-6" href="/create">
              开启新故事
            </Link>
          </PaperPanel>
        )}
      </section>
    </main>
  );
}
