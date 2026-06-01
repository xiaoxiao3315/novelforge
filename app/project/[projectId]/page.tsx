import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  findPlotFilterLabel,
  type PlotFilterKey,
} from "@/data/plot-filters";
import { createClient } from "@/lib/supabase/server";

type StoryConfig = {
  theme: string | null;
  genre: string | null;
  background: string | null;
  world_setting: string | null;
  protagonist: string | null;
  core_conflict: string | null;
  tone: string | null;
  serial_structure: string | null;
  extra_ideas: string | null;
};

const configRows: Array<{
  key: keyof StoryConfig;
  filterKey?: PlotFilterKey;
  label: string;
}> = [
  { key: "theme", filterKey: "themes", label: "主题" },
  { key: "genre", filterKey: "genres", label: "类型" },
  { key: "background", filterKey: "backgrounds", label: "背景" },
  { key: "world_setting", filterKey: "worldSettings", label: "世界设定" },
  { key: "protagonist", filterKey: "protagonists", label: "主角" },
  { key: "core_conflict", filterKey: "coreConflicts", label: "核心冲突" },
  { key: "tone", filterKey: "tones", label: "基调" },
  { key: "serial_structure", filterKey: "serialStructures", label: "连载结构" },
];

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/project/${projectId}`);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,description,status,created_at,updated_at")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    notFound();
  }

  const { data: config } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfig>();

  return (
    <main className="app-shell py-8">
      <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/dashboard" className="text-xl font-black">
          NovelForge / 小说工坊
        </Link>
        <SignOutButton />
      </nav>

      <section className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
          project
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-[var(--ink)]">{project.title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">
              {project.description || "暂未填写简介"}
            </p>
          </div>
          <Link className="button-secondary" href="/dashboard">
            返回工作台
          </Link>
        </div>
      </section>

      <section className="surface mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">剧情筛选器</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              这些输入已保存到 story_configs，WO-004 会基于它们生成作品设定。
            </p>
          </div>
          <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
            {project.status}
          </span>
        </div>

        {config ? (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {configRows.map((row) => (
                <div
                  className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
                  key={row.key}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    {row.label}
                  </p>
                  <p className="mt-1 font-bold text-[var(--ink)]">
                    {row.filterKey
                      ? findPlotFilterLabel(row.filterKey, config[row.key])
                      : config[row.key] || "未填写"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                补充想法
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                {config.extra_ideas || "未填写"}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
            <p className="font-bold text-[var(--ink)]">未找到剧情筛选器配置</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              该作品可能是在配置流程完成前创建的。
            </p>
          </div>
        )}
      </section>

      <section className="surface mt-6 p-6">
        <h2 className="text-2xl font-black text-[var(--ink)]">下一步</h2>
        <p className="mt-2 leading-7 text-[var(--muted)]">
          WO-003 到此为止。作品设定生成、故事圣经、章节大纲和正文不在当前工作单范围内。
        </p>
      </section>
    </main>
  );
}
