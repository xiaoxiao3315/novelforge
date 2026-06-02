import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { BibleGenerator } from "@/components/project/bible-generator";
import { ConceptGenerator } from "@/components/project/concept-generator";
import { OutlineGenerator } from "@/components/project/outline-generator";
import {
  ProjectWorkbenchLayout,
  type ConfigDisplayItem,
} from "@/components/project/project-workbench";
import { PaperPanel } from "@/components/ui/book";
import { buildStoryConfigDisplayItems } from "@/data/plot-filters";
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

function buildConfigItems(config: StoryConfig | null): ConfigDisplayItem[] {
  return buildStoryConfigDisplayItems(config);
}

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

  const directorSlot = config ? (
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
    <PaperPanel className="p-5">
      <h2 className="font-serif text-2xl font-black text-[var(--ink)]">作品设定</h2>
      <p className="mt-2 leading-7 text-[var(--muted)]">
        缺少 story_config，不能生成作品设定。
      </p>
    </PaperPanel>
  );

  return (
    <main className="app-shell py-8">
      <AppNav isAuthed creditBalance={creditBalance} />

      <ProjectWorkbenchLayout
        chapters={chapters}
        configItems={buildConfigItems(config)}
        creditBalance={creditBalance}
        directorSlot={directorSlot}
        extraIdeas={config?.extra_ideas ?? null}
        hasConfig={Boolean(config)}
        interactiveState={interactiveState}
        project={project}
        projectMode={projectMode}
        volume={volume}
      />
    </main>
  );
}
