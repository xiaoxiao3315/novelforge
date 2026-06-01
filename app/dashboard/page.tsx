import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
      <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="text-xl font-black">
          NovelForge / 小说工坊
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link className="button-secondary" href="/account/credits">
            点数余额：{creditBalance ?? "读取失败"}
          </Link>
          <SignOutButton />
        </div>
      </nav>

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          dashboard
        </p>
        <h1 className="mt-2 text-4xl font-black text-[var(--ink)]">我的作品</h1>
        <p className="mt-3 text-[var(--muted)]">
          当前登录账号：{user.email || user.id}
        </p>
      </section>

      <section className="surface mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">作品列表</h2>
            <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
              这里显示当前账号通过 RLS 可访问的作品。刷新页面后会重新从
              Supabase 读取。
            </p>
          </div>
          <Link className="button-primary" href="/create">
            创建作品
          </Link>
        </div>

        {projectsError ? (
          <div className="mt-6 rounded-md border border-[#e2b6a6] bg-[#fff4ef] p-4 text-sm text-[#7f2f1d]">
            读取作品失败：{projectsError.message}
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
            <p className="mt-2 text-sm text-[var(--muted)]">
              先创建一个作品，保存剧情筛选器和补充想法。
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
