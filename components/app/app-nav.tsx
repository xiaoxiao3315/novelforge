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
        <span className="app-nav-brand-text">
          <span>NovelForge</span>
          <span className="app-nav-subtitle">进入一段会记住你选择的故事</span>
        </span>
      </Link>
      <div className="app-nav-links">
        <Link className="app-nav-link" href="/">
          首页
        </Link>
        {isAuthed ? (
          <>
            <Link className="app-nav-link" href="/dashboard">
              我的故事
            </Link>
            <Link className="app-nav-link" href="/create">
              开启新故事
            </Link>
            <Link className="app-nav-link app-nav-credit-link" href="/account/credits">
              <span className="app-nav-credit-text">星火补给</span>
              <CreditBadge balance={creditBalance} label="星火" />
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
