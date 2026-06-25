import { AppNav } from "@/components/app/app-nav";
import { CreateProjectForm } from "@/components/project/create-project-form";
import { BookBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";

export const metadata = {
  title: "开启新故事",
};

export default async function CreateProjectPage() {
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
            内部单机模式会把项目保存到服务器本地文件。
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
