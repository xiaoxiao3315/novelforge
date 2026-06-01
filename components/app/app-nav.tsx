import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppNavProps = {
  isAuthed: boolean;
  creditBalance?: number | null;
};

export function AppNav({ isAuthed, creditBalance }: AppNavProps) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
      <Link href={isAuthed ? "/dashboard" : "/"} className="text-xl font-black">
        NovelForge / 小说工坊
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Link className="button-secondary min-h-10 px-4" href="/">
          首页
        </Link>
        {isAuthed ? (
          <>
            <Link className="button-secondary min-h-10 px-4" href="/dashboard">
              Dashboard
            </Link>
            <Link className="button-secondary min-h-10 px-4" href="/create">
              创建作品
            </Link>
            <Link className="button-secondary min-h-10 px-4" href="/account/credits">
              点数{typeof creditBalance === "number" ? `：${creditBalance}` : ""}
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link className="button-primary min-h-10 px-4" href="/login">
            登录
          </Link>
        )}
      </div>
    </nav>
  );
}
