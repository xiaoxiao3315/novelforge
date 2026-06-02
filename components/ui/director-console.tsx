"use client";

import { useState, type ReactNode } from "react";
import { ControlPanel } from "@/components/ui/book";

type DirectorConsoleProps = {
  children: ReactNode;
  className?: string;
  collapsedLabel?: string;
  defaultOpen?: boolean;
  eyebrow?: ReactNode;
  title?: ReactNode;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DirectorConsole({
  children,
  className,
  collapsedLabel = "展开导演台",
  defaultOpen = true,
  eyebrow = "AI Director",
  title = "AI 导演台",
}: DirectorConsoleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!isOpen) {
    return (
      <button
        aria-expanded="false"
        className={classes("director-console-tab", className)}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span className="director-console-tab-mark" aria-hidden="true" />
        <span>{collapsedLabel}</span>
      </button>
    );
  }

  return (
    <ControlPanel className={classes("director-console", className)}>
      <div className="director-console-header">
        <div>
          {eyebrow ? <p className="director-console-eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="director-console-title">{title}</h2> : null}
        </div>
        <button
          aria-expanded="true"
          className="director-console-collapse"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          收起导演台
        </button>
      </div>
      <div className="director-console-body">{children}</div>
    </ControlPanel>
  );
}

export { DirectorConsole as CollapsibleDirectorPanel };
