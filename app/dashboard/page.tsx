import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  return (
    <main className="app-shell py-8">
      <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="text-xl font-black">
          NovelForge / 小说工坊
        </Link>
        <SignOutButton />
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
              WO-001 暂不创建业务数据库表，所以这里先展示空状态。WO-003 会接入
              projects 查询和作品卡片。
            </p>
          </div>
          <button className="button-secondary" disabled>
            创建作品将在 WO-003 开放
          </button>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-8 text-center">
          <p className="font-bold text-[var(--ink)]">还没有作品</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            下一阶段会先建立最小数据库和 RLS，再开放创建流程。
          </p>
        </div>
      </section>
    </main>
  );
}

