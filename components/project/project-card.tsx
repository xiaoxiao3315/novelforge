import Link from "next/link";
import { BookBadge, BookCard, StatusBookmark } from "@/components/ui/book";
import type { ProjectMode } from "@/lib/projects/modes";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  created_at: string;
  mode: ProjectMode;
};

const modeStyles: Record<
  ProjectMode,
  {
    cta: string;
    descriptionFallback: string;
    label: string;
    short: string;
    tone: "gold" | "warning";
  }
> = {
  classic: {
    cta: "继续创作",
    descriptionFallback: "这本小说正在等待下一次翻开。进入后可以继续设定、大纲和章节正文。",
    label: "经典小说",
    short: "小说",
    tone: "gold",
  },
  interactive: {
    cta: "继续这段命运",
    descriptionFallback: "这段剧情正在等待你回到章节里，继续阅读、选择和推进。",
    label: "互动剧情",
    short: "命运",
    tone: "warning",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatArchiveStatus(status: string) {
  if (!status || status === "draft") {
    return "创作中";
  }

  if (status === "archived") {
    return "已归档";
  }

  if (status === "published") {
    return "已完成";
  }

  return status;
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const mode = modeStyles[project.mode];
  const updatedAt = formatDate(project.updated_at || project.created_at);
  const archiveStatus = formatArchiveStatus(project.status);

  return (
    <Link
      aria-label={`继续故事 ${project.title}`}
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
            <StatusBookmark tone="gold">{archiveStatus}</StatusBookmark>
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
            {project.description || mode.descriptionFallback}
          </p>

          <div className="mt-auto pt-5">
            <div className="grid gap-2 border-t border-[var(--line)] pt-4 text-xs font-bold text-[var(--muted)] sm:grid-cols-2">
              <p>
                <span className="text-[var(--gold-strong)]">上次翻阅</span> {updatedAt}
              </p>
              <p>
                <span className="text-[var(--gold-strong)]">存档状态</span> {archiveStatus}
              </p>
              <p>
                <span className="text-[var(--gold-strong)]">草稿</span> 存档保留
              </p>
              <p>
                <span className="text-[var(--gold-strong)]">已生成章节</span> 进入后查看
              </p>
            </div>
            <span className="button-secondary mt-4 min-h-10 w-full px-4 text-sm transition group-hover:border-[var(--gold)] group-hover:bg-[rgba(255,244,220,0.94)]">
              {mode.cta}
            </span>
          </div>
        </div>
      </BookCard>
    </Link>
  );
}
