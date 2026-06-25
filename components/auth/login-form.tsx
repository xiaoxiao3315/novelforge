"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserFacingError } from "@/lib/ui/errors";

type LoginFormProps = {
  redirectTo: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleGuestSignIn() {
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/guest", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setMessage(
          formatUserFacingError(payload?.error ?? "", "登录失败，请稍后重试。"),
        );
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setMessage("网络异常，登录请求未完成，请检查网络后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface p-6">
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-black text-[var(--ink)]">
          进入内部故事工作台
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          当前为内部单用户模式，数据保存在服务器的 INTERNAL_DATA_DIR。
        </p>
      </div>

      {message ? (
        <p className="mb-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {message}
        </p>
      ) : null}

      <button
        className="button-primary w-full"
        disabled={isSubmitting}
        onClick={handleGuestSignIn}
        type="button"
      >
        {isSubmitting ? "正在打开书房..." : "进入内部工作台"}
      </button>

      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        请在部署环境中设置 INTERNAL_AUTH_ENABLED=true，并把 INTERNAL_DATA_DIR 指向可持久化的服务器目录。
      </p>
    </section>
  );
}
