import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
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

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          dashboard
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-[var(--ink)]">我的作品</h1>
            <p className="mt-3 text-[var(--muted)]">
              从这里进入完整创作流程：创建作品、生成设定、生成大纲、写正文并确认正式稿。
            </p>
          </div>
          <Link className="button-primary" href="/create">
            创建作品
          </Link>
        </div>
      </section>

      <section className="surface mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">作品列表</h2>
            <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
              每个作品都会保存剧情筛选器、AI 生成结果、章节版本和正式稿状态。内测期间建议从一个短篇或第一卷开始验收。
            </p>
          </div>
          <Link className="button-secondary" href="/account/credits">
            查看点数与 Mock 支付
          </Link>
        </div>

        {projectsError ? (
          <div className="mt-6 rounded-md border border-[#e2b6a6] bg-[#fff4ef] p-4 text-sm text-[#7f2f1d]">
            作品列表暂时读取失败，请刷新页面重试。
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(projects as ProjectCardData[]).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-8 text-center">
            <p className="font-bold text-[var(--ink)]">还没有作品</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              先创建一个作品，选择题材、背景、主角和冲突。创建后就能按页面提示生成设定、故事圣经、章节大纲和正文。
            </p>
            <Link className="button-primary mt-5" href="/create">
              创建第一个作品
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
