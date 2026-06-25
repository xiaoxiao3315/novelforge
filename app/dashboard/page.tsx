import Link from "next/link";
import { AppNav } from "@/components/app/app-nav";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
import { BookBadge, CreditBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { getInternalProjectModeMap, listInternalProjects } from "@/lib/internal/store";

export const metadata = {
  title: "我的故事",
};

export default async function DashboardPage() {
  const projectRows = await listInternalProjects();
  const modeByProjectId = await getInternalProjectModeMap(
    projectRows.map((project) => project.id),
  );
  const projectCards: ProjectCardData[] = projectRows.map((project) => ({
    ...project,
    mode: modeByProjectId.get(project.id) ?? "classic",
  }));

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={9999} />

      <section className="dashboard-hero grid gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">Internal Mode</StatusBookmark>
            <BookBadge tone="ink">本地故事存档</BookBadge>
          </div>
          <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            我的故事
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-9 text-[var(--muted)]">
            当前使用内部单机模式，项目保存在服务器本地文件中。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="button-primary" href="/create">
              开启新故事
            </Link>
          </div>
        </div>

        <PaperPanel className="p-5">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">Internal Desk</p>
          <div className="mt-5 grid gap-4">
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">当前故事</p>
              <p className="mt-1 font-serif text-3xl font-black text-[var(--ink)]">
                {projectCards.length} 本
              </p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
              <p className="text-xs font-black text-[var(--muted)]">内部额度</p>
              <CreditBadge balance={9999} className="mt-2" label="星火" />
            </div>
          </div>
        </PaperPanel>
      </section>

      <section className="py-6">
        {projectCards.length > 0 ? (
          <div className="story-shelf-grid mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projectCards.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <PaperPanel className="mt-6 overflow-hidden p-8 text-center">
            <h3 className="font-serif text-2xl font-black text-[var(--ink)]">
              还没有故事
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
              创建第一本小说后，它会保存在服务器本地内部存档中。
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
