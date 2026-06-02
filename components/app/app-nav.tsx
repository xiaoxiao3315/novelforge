import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreditBadge } from "@/components/ui/book";

type AppNavProps = {
  isAuthed: boolean;
  creditBalance?: number | null;
};

export function AppNav({ isAuthed, creditBalance }: AppNavProps) {
  return (
    <nav className="app-nav">
      <Link href={isAuthed ? "/dashboard" : "/"} className="app-nav-brand">
        <span className="app-nav-brand-mark">NF</span>
        <span>NovelForge / 小说工坊</span>
      </Link>
      <div className="app-nav-links">
        <Link className="app-nav-link" href="/">
          首页
        </Link>
        {isAuthed ? (
          <>
            <Link className="app-nav-link" href="/dashboard">
              我的书架
            </Link>
            <Link className="app-nav-link" href="/create">
              新建作品
            </Link>
            <Link className="app-nav-link app-nav-credit-link" href="/account/credits">
              <CreditBadge balance={creditBalance} />
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
