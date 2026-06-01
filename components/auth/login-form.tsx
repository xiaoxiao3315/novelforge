"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatUserFacingError } from "@/lib/ui/errors";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const supabase = createClient();
    const authCall =
      mode === "sign-in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { data, error } = await authCall;
    setIsSubmitting(false);

    if (error) {
      setMessage(formatUserFacingError(error.message, "登录或注册失败，请检查邮箱和密码后重试。"));
      return;
    }

    if (mode === "sign-up" && !data.session) {
      setMessage("注册成功。请先到邮箱确认账号，再返回登录。");
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form className="surface p-6" onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-2xl font-black text-[var(--ink)]">
          {mode === "sign-in" ? "登录账号" : "注册账号"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          使用 Supabase Auth 邮箱密码登录。正式生产环境请在 Supabase 控制台配置站点 URL 和邮件模板。
        </p>
      </div>

      <label className="mb-4 block">
        <span className="mb-2 block text-sm font-bold text-[var(--ink)]">邮箱</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-2 block text-sm font-bold text-[var(--ink)]">密码</span>
        <input
          className="input"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {message ? (
        <p className="mb-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {message}
        </p>
      ) : null}

      <button className="button-primary w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "处理中..." : mode === "sign-in" ? "登录" : "注册"}
      </button>

      <button
        className="mt-4 w-full text-sm font-bold text-[var(--accent-strong)]"
        type="button"
        onClick={() => {
          setMessage("");
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
        }}
      >
        {mode === "sign-in" ? "没有账号？注册一个" : "已有账号？返回登录"}
      </button>
    </form>
  );
}
