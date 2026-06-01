import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="app-shell py-8">
      <nav className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
            NovelForge
          </p>
          <h1 className="text-2xl font-bold">小说工坊</h1>
        </div>
        <Link className="button-secondary" href={user ? "/dashboard" : "/login"}>
          {user ? "进入工作台" : "登录"}
        </Link>
      </nav>

      <section className="grid min-h-[calc(100vh-130px)] items-center gap-8 py-10 md:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
            AI novel studio
          </p>
          <h2 className="text-5xl font-black leading-tight text-[var(--ink)] md:text-6xl">
            把一个想法锻造成可持续连载的小说项目。
          </h2>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            第一阶段先完成账户入口和受保护工作台。后续 WO 将逐步接入剧情筛选器、作品设定生成和创作闭环。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href={user ? "/dashboard" : "/login"}>
              {user ? "打开我的作品" : "开始登录"}
            </Link>
            <Link className="button-secondary" href="/dashboard">
              测试路由保护
            </Link>
          </div>
        </div>

        <div className="surface p-5">
          <div className="rounded-md border border-[var(--line)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--accent-strong)]">
                WO-001
              </span>
              <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
                auth shell
              </span>
            </div>
            <div className="space-y-3">
              {["Next.js App Router", "Supabase SSR Auth", "Protected dashboard"].map(
                (item) => (
                  <div
                    className="flex items-center justify-between rounded-md border border-[#ece3d1] px-3 py-3 text-sm"
                    key={item}
                  >
                    <span>{item}</span>
                    <span className="font-bold text-[var(--accent-strong)]">ready</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

