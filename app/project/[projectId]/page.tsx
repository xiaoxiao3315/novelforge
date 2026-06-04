import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { OutlineGenerator } from "@/components/project/outline-generator";
import { ProjectWorkbenchLayout } from "@/components/project/project-workbench";
import { ensureCreditAccount } from "@/lib/credits";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
  type CharacterCard,
  type StoryBible,
} from "@/prompts/bible";
import { normalizeChapterContent, type ChapterContent } from "@/prompts/chapter";
import { normalizeStoryConcept, type StoryConcept } from "@/prompts/concept";
import { normalizeVolumeOutline, type VolumeOutline } from "@/prompts/outline";
import { normalizeInteractiveStoryState } from "@/prompts/story-state";

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
  config_json: unknown;
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

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ chapter?: string | string[] }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const rawChapterParam = Array.isArray(resolvedSearchParams?.chapter)
    ? resolvedSearchParams?.chapter[0]
    : resolvedSearchParams?.chapter;
  const parsedChapterNumber = Number.parseInt(rawChapterParam ?? "", 10);
  const currentChapterNumber = Number.isFinite(parsedChapterNumber)
    ? parsedChapterNumber
    : null;
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
      "theme,genre,background,world_setting,protagonist,core_conflict,tone,serial_structure,extra_ideas,config_json",
    )
    .eq("project_id", projectId)
    .maybeSingle<StoryConfig>();
  const projectMode = getProjectModeFromConfig(config?.config_json);
  const interactiveState =
    projectMode === "interactive"
      ? normalizeInteractiveStoryState(
          (config?.config_json as { interactiveState?: unknown } | undefined)?.interactiveState,
        )
      : null;

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
  const defaultChapterNumber =
    chapters.find((chapter) => chapter.official?.body || chapter.draft?.body)?.chapterNumber ??
    chapters[0]?.chapterNumber ??
    null;
  const visibleChapterNumber =
    currentChapterNumber && chapters.some((chapter) => chapter.chapterNumber === currentChapterNumber)
      ? currentChapterNumber
      : defaultChapterNumber;

  const hasOutlinePrerequisites = Boolean(concept && bible && characters.length > 0);
  const setupStatus = {
    hasBible: Boolean(bible),
    hasCharacters: characters.length > 0,
    hasConcept: Boolean(concept),
  };
  const outlineSlot = config ? (
    <OutlineGenerator
      creditBalance={creditBalance}
      currentChapterNumber={visibleChapterNumber}
      hasPrerequisites={hasOutlinePrerequisites}
      initialChapters={chapters}
      initialVolume={volume}
      projectId={projectId}
      projectMode={projectMode}
      setupStatus={setupStatus}
      variant="readerSidebar"
    />
  ) : null;

  const chapterGenerationSlot =
    outlineSlot ?? (
      <div className="reader-sidebar-outline">
        <p className="text-sm font-bold leading-6 text-[var(--muted)]">
          缺少作品设定，暂时无法铺开章节。
        </p>
      </div>
    );

  return (
    <main className="app-shell py-8">
      <AppNav
        creditBadgeLabel={projectMode === "interactive" ? "星火" : "额度"}
        creditBalance={creditBalance}
        creditLinkLabel={projectMode === "interactive" ? "星火补给" : "创作补给"}
        isAuthed
      />

      <ProjectWorkbenchLayout
        chapterGenerationSlot={chapterGenerationSlot}
        chapters={chapters}
        creditBalance={creditBalance}
        currentChapterNumber={visibleChapterNumber}
        interactiveState={interactiveState}
        project={project}
        projectMode={projectMode}
        volume={volume}
      />
    </main>
  );
}
