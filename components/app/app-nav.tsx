import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreditBadge } from "@/components/ui/book";

type AppNavProps = {
  creditLabel?: string;
  creditLinkLabel?: string;
  isAuthed: boolean;
  creditBalance?: number | null;
  variant?: "default" | "theater";
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppNav({
  creditLabel = "星火",
  creditLinkLabel,
  isAuthed,
  creditBalance,
  variant = "default",
}: AppNavProps) {
  const isTheater = variant === "theater";

  return (
    <nav className={classes("app-nav", isTheater && "app-nav-theater")}>
      <Link href={isAuthed ? "/dashboard" : "/"} className="app-nav-brand">
        <span className="app-nav-brand-mark">NF</span>
        <span className="app-nav-brand-text">
          <span>NovelForge</span>
          {isTheater ? (
            <span className="app-nav-subtitle">进入一段会记住你选择的故事</span>
          ) : (
            <span className="app-nav-subtitle">小说工坊</span>
          )}
        </span>
      </Link>
      <div className="app-nav-links">
        <Link className="app-nav-link" href="/">
          首页
        </Link>
        {isAuthed ? (
          <>
            <Link className="app-nav-link" href="/dashboard">
              {isTheater ? "我的书架" : "我的故事"}
            </Link>
            <Link className="app-nav-link" href="/create">
              {isTheater ? "创作" : "开启新故事"}
            </Link>
            <Link className="app-nav-link app-nav-credit-link" href="/account/credits">
              {creditLinkLabel ? <span className="app-nav-credit-text">{creditLinkLabel}</span> : null}
              <CreditBadge balance={creditBalance} label={creditLabel} />
            </Link>
            {isTheater ? <span className="app-nav-avatar">旅人</span> : null}
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
