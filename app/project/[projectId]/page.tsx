import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { OutlineGenerator } from "@/components/project/outline-generator";
import { ProjectWorkbenchLayout } from "@/components/project/project-workbench";
import { ensureCreditAccount } from "@/lib/credits";
import { hasInternalSession } from "@/lib/internal/auth";
import { getInternalProjectBundle } from "@/lib/internal/store";
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
  id: string;
  content: VolumeOutline | null;
};

type ChapterRow = {
  id: string;
  volume_id: string | null;
  content: ChapterContent | null;
};

type ChapterDisplay = ChapterContent & {
  id: string;
  volumeId?: string;
  versionCount: number;
};

type ChapterClaimGate = {
  chapterId: string;
  chapterNumber: number;
  autoClaim: boolean;
};

type ChapterVersionRow = {
  chapter_id: string;
};

function chapterNeedsRegeneration(chapter: ChapterDisplay | null | undefined) {
  return Boolean(chapter?.needsRegeneration || chapter?.stale);
}

function isUnclaimedReadChapter(chapter: ChapterDisplay | null | undefined) {
  return chapter?.readBilling?.state === "unclaimed";
}

function hasUnlockedReadableBody(chapter: ChapterDisplay | null | undefined) {
  return Boolean(
    chapter &&
      !chapterNeedsRegeneration(chapter) &&
      (chapter.official?.body || chapter.draft?.body) &&
      (!chapter.readBilling || chapter.readBilling.state === "charged"),
  );
}

function redactUnclaimedChapterBody(chapter: ChapterDisplay): ChapterDisplay {
  if (!isUnclaimedReadChapter(chapter)) {
    return chapter;
  }

  return {
    ...chapter,
    ...(chapter.draft
      ? {
          draft: {
            ...chapter.draft,
            body: "",
          },
        }
      : {}),
    ...(chapter.official
      ? {
          official: {
            ...chapter.official,
            body: "",
          },
        }
      : {}),
  };
}

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
  const internalSession = await hasInternalSession();

  if (internalSession) {
    const bundle = await getInternalProjectBundle(projectId);

    if (!bundle) {
      notFound();
    }

    const { project, config } = bundle;
    const creditBalance = 9999;
    const projectMode = getProjectModeFromConfig(config?.config_json);
    const interactiveState =
      projectMode === "interactive"
        ? normalizeInteractiveStoryState(
            (config?.config_json as { interactiveState?: unknown } | undefined)?.interactiveState,
          )
        : null;
    const concept = normalizeStoryConcept(bundle.concept);
    const bible = normalizeStoryBible(bundle.bible);
    const characters = normalizeCharacterCards(bundle.characters);
    const volumes = new Map<string, VolumeOutline>();
    let firstVolume: VolumeOutline | null = null;

    for (const row of bundle.volumes) {
      const normalizedVolume = normalizeVolumeOutline(row.content);

      if (!normalizedVolume) {
        continue;
      }

      volumes.set(row.id, normalizedVolume);
      firstVolume ??= normalizedVolume;
    }

    const chapters: ChapterDisplay[] = [];

    for (const row of bundle.chapters) {
      const content = normalizeChapterContent(row.content);

      if (!content) {
        continue;
      }

      chapters.push({
        ...content,
        id: row.id,
        ...(row.volume_id ? { volumeId: row.volume_id } : {}),
        versionCount: content.versionCount ?? 0,
      });
    }

    chapters.sort((left, right) => left.chapterNumber - right.chapterNumber);
    const defaultChapterNumber =
      chapters.find((chapter) => hasUnlockedReadableBody(chapter))?.chapterNumber ??
      chapters[0]?.chapterNumber ??
      null;
    const hasRequestedExistingChapter = Boolean(
      currentChapterNumber &&
        chapters.some((chapter) => chapter.chapterNumber === currentChapterNumber),
    );
    const visibleChapterNumber =
      hasRequestedExistingChapter && currentChapterNumber
        ? currentChapterNumber
        : defaultChapterNumber;
    const visibleChapter = chapters.find(
      (chapter) => chapter.chapterNumber === visibleChapterNumber,
    );
    const displayChapters = chapters.map(redactUnclaimedChapterBody);
    const volume = visibleChapter?.volumeId
      ? volumes.get(visibleChapter.volumeId) ?? firstVolume
      : firstVolume;
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
        initialChapters={displayChapters}
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
          chapters={displayChapters}
          creditBalance={creditBalance}
          currentChapterClaimGate={null}
          currentChapterNumber={visibleChapterNumber}
          interactiveState={interactiveState}
          project={project}
          projectMode={projectMode}
          volume={volume}
        />
      </main>
    );
  }

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
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    notFound();
  }

  const creditAccount = await ensureCreditAccount(supabase);
  const creditBalance = creditAccount.ok ? creditAccount.balance : null;

  const { data: config, error: configError } = await supabase
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

  const { data: storyConcept, error: conceptLoadError } = await supabase
    .from("story_concepts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryConceptRow>();

  const concept = normalizeStoryConcept(storyConcept?.content);

  const { data: storyBible, error: bibleLoadError } = await supabase
    .from("story_bibles")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle<StoryBibleRow>();

  const { data: characterRows, error: charactersLoadError } = await supabase
    .from("characters")
    .select("content")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .returns<CharacterRow[]>();

  const bible = normalizeStoryBible(storyBible?.content);
  const characters = normalizeCharacterCards(characterRows?.map((row) => row.content) ?? []);

  const { data: volumeRows, error: volumesLoadError } = await supabase
    .from("volumes")
    .select("id,content")
    .eq("project_id", projectId)
    .order("volume_number", { ascending: true })
    .returns<VolumeRow[]>();

  const { data: chapterRows, error: chaptersLoadError } = await supabase
    .from("chapters")
    .select("id,volume_id,content")
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true })
    .returns<ChapterRow[]>();

  const { data: chapterVersionRows, error: versionsLoadError } = await supabase
    .from("chapter_versions")
    .select("chapter_id")
    .eq("project_id", projectId)
    .returns<ChapterVersionRow[]>();

  const loadErrors = [
    configError ? `作品设定读取失败：${configError.message}` : null,
    conceptLoadError ? `作品概念读取失败：${conceptLoadError.message}` : null,
    bibleLoadError ? `故事圣经读取失败：${bibleLoadError.message}` : null,
    charactersLoadError ? `角色卡读取失败：${charactersLoadError.message}` : null,
    volumesLoadError ? `卷信息读取失败：${volumesLoadError.message}` : null,
    chaptersLoadError ? `章节读取失败：${chaptersLoadError.message}` : null,
    versionsLoadError ? `章节版本读取失败：${versionsLoadError.message}` : null,
  ].filter((item): item is string => Boolean(item));

  const chapterVersionCounts = new Map<string, number>();

  for (const row of chapterVersionRows ?? []) {
    chapterVersionCounts.set(row.chapter_id, (chapterVersionCounts.get(row.chapter_id) ?? 0) + 1);
  }

  const volumes = new Map<string, VolumeOutline>();
  let firstVolume: VolumeOutline | null = null;

  for (const row of volumeRows ?? []) {
    const normalizedVolume = normalizeVolumeOutline(row.content);

    if (!normalizedVolume) {
      continue;
    }

    volumes.set(row.id, normalizedVolume);
    firstVolume ??= normalizedVolume;
  }

  const chapters: ChapterDisplay[] = [];

  for (const row of chapterRows ?? []) {
    const content = normalizeChapterContent(row.content);

    if (!content) {
      continue;
    }

    chapters.push({
      ...content,
      id: row.id,
      ...(row.volume_id ? { volumeId: row.volume_id } : {}),
      versionCount: chapterVersionCounts.get(row.id) ?? content.versionCount ?? 0,
    });
  }

  chapters.sort((left, right) => left.chapterNumber - right.chapterNumber);
  const defaultChapterNumber =
    chapters.find((chapter) => hasUnlockedReadableBody(chapter))?.chapterNumber ??
    chapters[0]?.chapterNumber ??
    null;
  const hasRequestedExistingChapter = Boolean(
    currentChapterNumber &&
      chapters.some((chapter) => chapter.chapterNumber === currentChapterNumber),
  );
  const visibleChapterNumber =
    hasRequestedExistingChapter && currentChapterNumber
      ? currentChapterNumber
      : defaultChapterNumber;
  const visibleChapter = chapters.find((chapter) => chapter.chapterNumber === visibleChapterNumber);
  // 只要当前展示章节未解锁就显示付费门：显式请求的章节自动解锁，
  // 默认落点章节改为手动确认，避免误扣费，也避免显示“尚未生成”的误导文案。
  const currentChapterClaimGate: ChapterClaimGate | null =
    visibleChapter && isUnclaimedReadChapter(visibleChapter)
      ? {
          chapterId: visibleChapter.id,
          chapterNumber: visibleChapter.chapterNumber,
          autoClaim: hasRequestedExistingChapter,
        }
      : null;
  const displayChapters = chapters.map(redactUnclaimedChapterBody);
  const volume = visibleChapter?.volumeId
    ? volumes.get(visibleChapter.volumeId) ?? firstVolume
    : firstVolume;

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
      initialChapters={displayChapters}
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

      {loadErrors.length > 0 ? (
        <div
          className="mt-4 rounded-md border border-[rgba(138,58,33,0.32)] bg-[rgba(138,58,33,0.08)] px-4 py-3 text-sm font-bold text-[var(--warning)]"
          role="alert"
        >
          部分数据读取失败，页面可能显示不完整，请刷新重试。
          {loadErrors.map((item) => (
            <span className="mt-1 block font-normal" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <ProjectWorkbenchLayout
        chapterGenerationSlot={chapterGenerationSlot}
        chapters={displayChapters}
        creditBalance={creditBalance}
        currentChapterClaimGate={currentChapterClaimGate}
        currentChapterNumber={visibleChapterNumber}
        interactiveState={interactiveState}
        project={project}
        projectMode={projectMode}
        volume={volume}
      />
    </main>
  );
}
