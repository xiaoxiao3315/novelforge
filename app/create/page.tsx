import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { CreateProjectForm } from "@/components/project/create-project-form";
import { ensureCreditAccount } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

export default async function CreateProjectPage() {
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

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          create project
        </p>
        <h1 className="mt-2 text-4xl font-black text-[var(--ink)]">创建作品</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">
          先用剧情筛选器固定题材、世界、主角、冲突和连载结构。创建动作不会消耗点数，AI 生成从项目页开始。
        </p>
      </section>

      <section className="mt-8">
        <CreateProjectForm />
      </section>
    </main>
  );
}
