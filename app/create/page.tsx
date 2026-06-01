import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateProjectForm } from "@/components/project/create-project-form";
import { createClient } from "@/lib/supabase/server";

export default async function CreateProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/create");
  }

  return (
    <main className="app-shell py-8">
      <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/dashboard" className="text-xl font-black">
          NovelForge / 小说工坊
        </Link>
        <SignOutButton />
      </nav>

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          create project
        </p>
        <h1 className="mt-2 text-4xl font-black text-[var(--ink)]">创建作品</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">
          先用剧情筛选器固定作品方向。WO-003 只保存设定输入，后续 WO-004 才会生成作品基础设定。
        </p>
      </section>

      <section className="mt-8">
        <CreateProjectForm />
      </section>
    </main>
  );
}
