import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { LoginForm } from "@/components/auth/login-form";
import { BookBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { hasInternalSession } from "@/lib/internal/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "登录",
};

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
  const internalSession = await hasInternalSession();
  const params = await searchParams;
  const redirectTo = normalizeRedirectTo(params?.redirectTo);

  if (internalSession) {
    redirect(redirectTo);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed={false} />

      <section className="login-hero grid min-h-[calc(100vh-140px)] items-center gap-8 md:grid-cols-[1fr_420px]">
        <div className="flex flex-col justify-center">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">Beta Access</StatusBookmark>
            <BookBadge tone="ink">故事入口</BookBadge>
          </div>
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
            Return To NovelForge
          </p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
            回到你的故事书房
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
            登录后继续你的故事存档，或开启一本新故事。星火只用于驱动 AI 生成，
            阅读、查看和确认文本不会额外消耗。
          </p>
          <PaperPanel className="mt-8 max-w-xl p-5">
            <p className="text-sm font-black text-[var(--gold-strong)]">内测提示</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              真实支付尚未接入；星火补给与 Mock 支付只用于测试闭环。
            </p>
          </PaperPanel>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </section>
    </main>
  );
}
