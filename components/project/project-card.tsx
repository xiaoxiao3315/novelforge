import Link from "next/link";
import { BookBadge, BookCard, StatusBookmark } from "@/components/ui/book";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  created_at: string;
  mode?: "classic" | "interactive" | string | null;
};

const modeLabels = {
  classic: {
    label: "经典小说模式",
    short: "经典",
    tone: "gold" as const,
  },
  interactive: {
    label: "互动剧情模式",
    short: "互动",
    tone: "warning" as const,
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function getModeDisplay(mode: ProjectCardData["mode"]) {
  return mode === "interactive" ? modeLabels.interactive : modeLabels.classic;
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const mode = getModeDisplay(project.mode);
  const updatedAt = formatDate(project.updated_at || project.created_at);

  return (
    <Link
      aria-label={`进入作品 ${project.title}`}
      className="group block h-full"
      href={`/project/${project.id}`}
    >
      <BookCard className="h-full" spine={mode.short}>
        <div className="flex min-h-[190px] flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <BookBadge tone={mode.tone}>{mode.label}</BookBadge>
              <h3 className="mt-4 line-clamp-2 font-serif text-2xl font-black leading-tight text-[var(--ink)]">
                {project.title}
              </h3>
            </div>
            <StatusBookmark tone="gold">{project.status}</StatusBookmark>
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
            {project.description ||
              "暂无简介。进入这本书后，可以继续生成设定、故事圣经、章节大纲和正文。"}
          </p>

          <div className="mt-auto pt-5">
            <div className="grid gap-2 border-t border-[var(--line)] pt-4 text-xs font-bold text-[var(--muted)] sm:grid-cols-2">
              <p>
                <span className="text-[var(--gold-strong)]">最近翻阅</span> {updatedAt}
              </p>
              <p>
                <span className="text-[var(--gold-strong)]">创作进度</span> {project.status}
              </p>
            </div>
            <span className="button-secondary mt-4 min-h-10 w-full px-4 text-sm transition group-hover:border-[var(--gold)] group-hover:bg-[rgba(255,244,220,0.94)]">
              进入创作
            </span>
          </div>
        </div>
      </BookCard>
    </Link>
  );
}
