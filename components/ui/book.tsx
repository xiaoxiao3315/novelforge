import type { ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

type BadgeTone = "ink" | "gold" | "paper" | "success" | "warning";

type SectionTab = {
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PaperPanel({ children, className }: BaseProps) {
  return <section className={classes("paper-panel", className)}>{children}</section>;
}

export function ControlPanel({ children, className }: BaseProps) {
  return <aside className={classes("control-panel", className)}>{children}</aside>;
}

export function BookCard({
  children,
  className,
  spine,
}: BaseProps & {
  spine?: ReactNode;
}) {
  return (
    <article className={classes("book-card", className)}>
      <div className="book-card-spine">{spine}</div>
      <div className="book-card-content">{children}</div>
    </article>
  );
}

export function BookBadge({
  children,
  className,
  tone = "paper",
}: BaseProps & {
  tone?: BadgeTone;
}) {
  return (
    <span className={classes("book-badge", `book-badge-${tone}`, className)}>{children}</span>
  );
}

export function CreditBadge({
  balance,
  className,
  label = "星火",
}: {
  balance?: number | null;
  className?: string;
  label?: string;
}) {
  return (
    <span className={classes("credit-badge", className)}>
      <span className="credit-badge-label">{label}</span>
      <span className="credit-badge-value">{typeof balance === "number" ? balance : "--"}</span>
    </span>
  );
}

export function StatusBookmark({
  children,
  className,
  tone = "gold",
}: BaseProps & {
  tone?: BadgeTone;
}) {
  return (
    <span className={classes("status-bookmark", `status-bookmark-${tone}`, className)}>
      {children}
    </span>
  );
}

export function ReaderPage({
  children,
  className,
  footer,
  title,
}: BaseProps & {
  footer?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <article className={classes("reader-page", className)}>
      {title ? <header className="reader-page-header">{title}</header> : null}
      <div className="reader-page-body">{children}</div>
      {footer ? <footer className="reader-page-footer">{footer}</footer> : null}
    </article>
  );
}

export function SectionTabs({
  activeId,
  className,
  tabs,
}: {
  activeId: string;
  className?: string;
  tabs: SectionTab[];
}) {
  return (
    <nav aria-label="Section tabs" className={classes("section-tabs", className)}>
      {tabs.map((tab) => {
        const tabClassName = classes(
          "section-tab",
          tab.id === activeId && "section-tab-active",
          tab.disabled && "section-tab-disabled",
        );

        if (tab.href && !tab.disabled) {
          return (
            <a className={tabClassName} href={tab.href} key={tab.id}>
              {tab.label}
            </a>
          );
        }

        return (
          <span aria-current={tab.id === activeId ? "page" : undefined} className={tabClassName} key={tab.id}>
            {tab.label}
          </span>
        );
      })}
    </nav>
  );
}
