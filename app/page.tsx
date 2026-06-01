import Link from "next/link";
import { AppNav } from "@/components/app/app-nav";
import { createClient } from "@/lib/supabase/server";

const highlights = [
  "剧情筛选器创建作品方向",
  "DeepSeek 生成设定、故事圣经、大纲和正文",
  "导演指令干预单章内容",
  "章节版本与正式稿留痕",
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed={Boolean(user)} />

      <section className="grid min-h-[calc(100vh-140px)] items-center gap-8 py-10 md:grid-cols-[1fr_380px]">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
            v0.1 内测版
          </p>
          <h1 className="text-5xl font-black leading-tight text-[var(--ink)] md:text-6xl">
            互动小说生成工作台
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            NovelForge 帮你从一个想法出发，逐步生成作品设定、故事圣经、章节大纲和单章正文。你可以在章节阶段加入导演指令，干预情绪、冲突、伏笔和结尾钩子。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href={user ? "/dashboard" : "/login"}>
              {user ? "进入 Dashboard" : "登录开始内测"}
            </Link>
            <Link className="button-secondary" href="/account/credits">
              查看点数系统
            </Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
            当前为内测版：生成内容需要人工判断和调整；点数充值仍是 Mock 支付，仅用于测试闭环。
          </p>
        </div>

        <div className="surface p-5">
          <h2 className="text-xl font-black text-[var(--ink)]">MVP 流程</h2>
          <div className="mt-4 grid gap-3">
            {highlights.map((item, index) => (
              <div
                className="rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm"
                key={item}
              >
                <span className="mr-2 font-black text-[var(--accent-strong)]">
                  {index + 1}.
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
