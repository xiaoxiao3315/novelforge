import { redirect } from "next/navigation";
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
    <main className="app-shell flex min-h-screen items-center justify-center py-8">
      <section className="grid w-full gap-8 md:grid-cols-[1fr_420px]">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
            NovelForge
          </p>
          <h1 className="text-5xl font-black leading-tight text-[var(--ink)]">
            登录小说工坊
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
            WO-001 只处理账户入口和受保护工作台。作品、数据库业务表和 AI 生成会在后续工作单进入。
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </section>
    </main>
  );
}
