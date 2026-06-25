import { notFound } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { OutlineGenerator } from "@/components/project/outline-generator";
import { ProjectWorkbenchLayout } from "@/components/project/project-workbench";
import { getInternalProjectBundle } from "@/lib/internal/store";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import {
  normalizeCharacterCards,
  normalizeStoryBible,
} from "@/prompts/bible";
import { normalizeChapterContent, type ChapterContent } from "@/prompts/chapter";
import { normalizeStoryConcept } from "@/prompts/concept";
import { normalizeVolumeOutline, type VolumeOutline } from "@/prompts/outline";
import { normalizeInteractiveStoryState } from "@/prompts/story-state";

type ChapterDisplay = ChapterContent & {
  id: string;
  volumeId?: string;
  versionCount: number;
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
