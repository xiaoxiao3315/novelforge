import Link from "next/link";
import { PROJECT_MODE_LABELS, type ProjectMode } from "@/lib/projects/modes";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  created_at: string;
  mode: ProjectMode;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      className="block rounded-md border border-[var(--line)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
      href={`/project/${project.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-[var(--ink)]">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
            {project.description || "暂无简介，进入项目后可继续生成设定和章节。"}
          </p>
        </div>
        <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
          {PROJECT_MODE_LABELS[project.mode]}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <span>{project.status}</span>
        <span>最近更新 {formatDate(project.updated_at || project.created_at)}</span>
      </div>
    </Link>
  );
}
