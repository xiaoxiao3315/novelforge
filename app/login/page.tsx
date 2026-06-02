import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

function normalizeRedirectTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirectTo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const redirectTo = normalizeRedirectTo(params?.redirectTo);

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed={false} />

      <section className="grid min-h-[calc(100vh-140px)] items-center gap-8 md:grid-cols-[1fr_420px]">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
            beta access
          </p>
          <h1 className="text-5xl font-black leading-tight text-[var(--ink)]">
            登录 NovelForge 内测
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
            登录后可以创建作品，使用 DeepSeek 铺开设定、故事圣经、章节大纲和正文。星火只用于驱动 AI 生成，查看和确认正式稿不消耗星火。
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </section>
    </main>
  );
}
