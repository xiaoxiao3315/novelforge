import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { BibleGenerator } from "@/components/project/bible-generator";
import { ConceptGenerator } from "@/components/project/concept-generator";
import { OutlineGenerator } from "@/components/project/outline-generator";
import {
  findPlotFilterLabel,
  type PlotFilterKey,
} from "@/data/plot-filters";
import { ensureCreditAccount } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeChapterContent, type ChapterContent } from "@/prompts/chapter";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import {
  normalizeVolumeOutline,
  type VolumeOutline,
} from "@/prompts/outline";

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

type StoryConceptRow = {
  content: StoryConcept | null;
};

type StoryBibleRow = {
  content: StoryBible | null;
};

type CharacterRow = {
  content: CharacterCard | null;
};

type VolumeRow = {
  content: VolumeOutline | null;
};

type ChapterRow = {
  id: string;
  content: ChapterContent | null;
};

type ChapterDisplay = ChapterContent & {
  id: string;
  versionCount: number;
};

type ChapterVersionRow = {
  chapter_id: string;
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

  const creditAccount = await ensureCreditAccount(supabase);
  const creditBalance = creditAccount.ok ? creditAccount.balance : null;

  const { data: config } = await supabase
    .from("story_configs")
    .select(
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfig>();

  const { data: storyConcept } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();

  const concept = normalizeStoryConcept(storyConcept?.content);

  const { data: storyBible } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryBibleRow>();

  const { data: characterRows } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();

  const bible = normalizeStoryBible(storyBible?.content);
  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  const { data: volumeRow } = await supabase
    .from("volumes")
    .select("content")
    .eq("project_id", projectId)
    .order("volume_number", { ascending: true })
    .limit(1)
    .maybeSingle<VolumeRow>();

  const { data: chapterRows } = await supabase
    .from("chapters")
    .select("id,content")
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true })
    .returns<ChapterRow[]>();

  const { data: chapterVersionRows } = await supabase
    .from("chapter_versions")
    .select("chapter_id")
    .eq("project_id", projectId)
    .returns<ChapterVersionRow[]>();

  const chapterVersionCounts = new Map<string, number>();

  for (const row of chapterVersionRows ?? []) {
    chapterVersionCounts.set(row.chapter_id, (chapterVersionCounts.get(row.chapter_id) ?? 0) + 1);
  }

  const volume = normalizeVolumeOutline(volumeRow?.content);
  const chapters: ChapterDisplay[] = [];

  for (const row of chapterRows ?? []) {
    const content = normalizeChapterContent(row.content);

    if (!content) {
      continue;
    }

    chapters.push({
      ...content,
      id: row.id,
      versionCount: chapterVersionCounts.get(row.id) ?? content.versionCount ?? 0,
    });
  }

  chapters.sort((left, right) => left.chapterNumber - right.chapterNumber);

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

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

      <section className="surface mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">创作流程</h2>
            <p className="mt-2 max-w-3xl leading-7 text-[var(--muted)]">
              按顺序推进会最稳定。每次 AI 生成可能需要几十秒；生成失败不会覆盖已保存内容，也不会扣点。
            </p>
          </div>
          <Link className="button-secondary" href="/account/credits">
            点数与 Mock 支付
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            "第一步：生成作品设定",
            "第二步：生成故事圣经",
            "第三步：生成章节大纲",
            "第四步：填写导演指令并生成正文",
            "第五步：设为正式稿",
          ].map((step) => (
            <div
              className="rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm font-bold text-[var(--ink)]"
              key={step}
            >
              {step}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          内测提示：AI 生成内容可能需要人工调整；章节正文可以多次重新生成，每次都会保留版本，确认满意后再设为正式稿。
        </p>
      </section>

      <section className="surface mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--ink)]">剧情筛选器</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              这些输入会作为后续 AI 生成的基础，影响作品设定、故事圣经、大纲和正文风格。
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

      {config ? (
        <>
          <ConceptGenerator
            creditBalance={creditBalance}
            initialConcept={concept}
            projectId={projectId}
          />
          <BibleGenerator
            creditBalance={creditBalance}
            hasConcept={Boolean(concept)}
            initialBible={bible}
            initialCharacters={characters}
            projectId={projectId}
          />
          <OutlineGenerator
            creditBalance={creditBalance}
            hasPrerequisites={Boolean(concept && bible && characters.length > 0)}
            initialChapters={chapters}
            initialVolume={volume}
            projectId={projectId}
          />
        </>
      ) : (
        <section className="surface mt-6 p-6">
          <h2 className="text-2xl font-black text-[var(--ink)]">作品设定</h2>
          <p className="mt-2 leading-7 text-[var(--muted)]">
            缺少 story_config，不能生成作品设定。
          </p>
        </section>
      )}
    </main>
  );
}
