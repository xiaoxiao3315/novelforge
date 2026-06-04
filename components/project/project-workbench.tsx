import type { ReactNode } from "react";
import { ChapterContinueAction } from "@/components/project/chapter-continue-action";
import { ChapterEndDecision } from "@/components/project/chapter-end-decision";
import {
  BookBadge,
  CreditBadge,
  PaperPanel,
  ReaderPage,
  SectionTabs,
} from "@/components/ui/book";
import type { ProjectMode } from "@/lib/projects/modes";
import type { ChapterContent } from "@/prompts/chapter";
import type { ChapterSummary } from "@/prompts/chapter-summary";
import type { VolumeOutline } from "@/prompts/outline";
import type { InteractiveStoryState } from "@/prompts/story-state";

export type WorkbenchProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  created_at: string;
};

export type WorkbenchChapter = ChapterContent & {
  id: string;
  versionCount: number;
};

type ProjectWorkbenchLayoutProps = {
  chapterGenerationSlot?: ReactNode;
  chapters: WorkbenchChapter[];
  creditBalance: number | null;
  currentChapterNumber?: number | null;
  interactiveState: InteractiveStoryState | null;
  project: WorkbenchProject;
  projectMode: ProjectMode;
  volume: VolumeOutline | null;
};

function formatSummaryValue(value: string | string[]) {
  return Array.isArray(value) ? value.join("；") : value;
}

const qualityScoreLabels = [
  ["pacing", "节奏"],
  ["conflict", "冲突"],
  ["emotion", "情绪"],
  ["characterConsistency", "人物一致性"],
  ["worldConsistency", "设定一致性"],
  ["proseQuality", "语言质感"],
  ["hookStrength", "结尾钩子"],
  ["commercialAppeal", "追更欲"],
] as const;

type WorkbenchQualityMetadata = NonNullable<NonNullable<WorkbenchChapter["draft"]>["quality"]>;

function getQualityScoreItems(chapter: WorkbenchChapter | null) {
  const scores = chapter?.draft?.quality?.critique?.scores;

  return qualityScoreLabels.map(([key, label]) => {
    const value = scores?.[key];

    return {
      key,
      label,
      value: typeof value === "number" ? value : null,
    };
  });
}

function formatQualityPipelineStatus(quality: WorkbenchQualityMetadata) {
  if (quality.status === "success") {
    return "流水线完成";
  }

  if (quality.status === "failed") {
    return "流水线失败";
  }

  if (quality.steps?.rewrite === "success" || quality.steps?.rewrite === "skipped") {
    return "流水线完成";
  }

  if (quality.steps?.critique === "success") {
    return "审稿完成";
  }

  return "--";
}

function formatRewriteStatus(quality: WorkbenchQualityMetadata) {
  if (quality.rewriteApplied === true) {
    return "已执行精修";
  }

  if (quality.rewriteApplied === false) {
    return "未执行精修：初稿评分已达标";
  }

  return "--";
}

function getChapterStatus(chapter: WorkbenchChapter) {
  if (chapter.official) {
    return "正式稿";
  }

  if (chapter.draft?.body) {
    return "草稿";
  }

  return "未生成";
}

function getChapterDisplayStatus(chapter: WorkbenchChapter, projectMode: ProjectMode) {
  if (projectMode !== "interactive") {
    return getChapterStatus(chapter);
  }

  if (chapter.decision?.selectedOptionId || chapter.decision?.customChoice?.trim()) {
    return "命运已定";
  }

  if (chapter.official?.body || chapter.draft?.body) {
    return "可阅读";
  }

  return "待开启";
}

function getReaderBody(chapter: WorkbenchChapter | null, projectMode: ProjectMode) {
  const isInteractive = projectMode === "interactive";

  if (!chapter) {
    return {
      body: "一键准备后，第 1 章会自动生成并出现在这里。",
      source: "等待章节",
    };
  }

  if (chapter.official?.body) {
    return {
      body: chapter.official.body,
      source: "正式稿",
    };
  }

  if (chapter.draft?.body) {
    return {
      body: chapter.draft.body,
      source: "草稿",
    };
  }

  return {
    body: isInteractive
      ? "这一章还没有正文。读完上一章并确认命运后，可以消耗星火进入下一章。"
      : "这一章还没有正文。读完当前章节后，可以消耗额度进入下一章。",
    source: "待生成",
  };
}

function ChapterSummaryPanel({ summary }: { summary: ChapterSummary | null }) {
  if (!summary) {
    return (
      <PaperPanel className="p-5">
        <h3 className="font-serif text-xl font-black text-[var(--ink)]">连续性状态</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          生成章节正文后，关键事件、关系变化、伏笔和下一章上下文会在这里沉淀。
        </p>
      </PaperPanel>
    );
  }

  const summaryItems: Array<{
    label: string;
    value: string | string[];
  }> = [
    { label: "关键事件", value: summary.keyEvents },
    { label: "角色状态", value: summary.characterStateChanges },
    { label: "关系变化", value: summary.relationshipChanges },
    { label: "伏笔线索", value: summary.foreshadowingAndClues },
    { label: "未解悬念", value: summary.unresolvedQuestions },
    { label: "结尾状态", value: summary.endingState },
    { label: "下章上下文", value: summary.continuityNotes },
  ];

  return (
    <PaperPanel className="p-5">
      <h3 className="font-serif text-xl font-black text-[var(--ink)]">连续性状态</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {summaryItems.map((item) => (
          <div
            className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3"
            key={item.label}
          >
            <p className="text-xs font-black text-[var(--gold-strong)]">{item.label}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
              {formatSummaryValue(item.value)}
            </p>
          </div>
        ))}
      </div>
    </PaperPanel>
  );
}

function ChapterQualityPanel({ chapter }: { chapter: WorkbenchChapter | null }) {
  const quality = chapter?.draft?.quality;

  if (!quality) {
    return null;
  }

  const qualityScoreItems = getQualityScoreItems(chapter);

  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-xl font-black text-[var(--ink)]">质量报告</h3>
        <BookBadge tone="gold">{quality.mode ?? "quality-v1"}</BookBadge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
          <p className="text-xs font-black text-[var(--gold-strong)]">整体评分</p>
          <p className="mt-1 font-serif text-3xl font-black text-[var(--brown)]">
            {quality.critique?.overallScore ?? "--"}
          </p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
          <p className="text-xs font-black text-[var(--gold-strong)]">流水线状态</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--ink)]">
            {formatQualityPipelineStatus(quality)}
          </p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
          <p className="text-xs font-black text-[var(--gold-strong)]">修订状态</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--ink)]">
            {formatRewriteStatus(quality)}
          </p>
        </div>
        {qualityScoreItems.map((item) => (
          <div
            className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3"
            key={item.key}
          >
            <p className="text-xs font-black text-[var(--gold-strong)]">{item.label}</p>
            <p className="mt-1 font-serif text-2xl font-black text-[var(--brown)]">
              {item.value ?? "--"}
            </p>
          </div>
        ))}
      </div>
    </PaperPanel>
  );
}

function ChapterReaderPreview({
  chapter,
  interactiveState,
  projectId,
  projectMode,
  creditBalance,
  hasNextChapter = false,
  nextChapterNumber = null,
  showBackmatter = true,
  volume,
}: {
  chapter: WorkbenchChapter | null;
  interactiveState: InteractiveStoryState | null;
  projectId: string;
  projectMode: ProjectMode;
  creditBalance?: number | null;
  hasNextChapter?: boolean;
  nextChapterNumber?: number | null;
  showBackmatter?: boolean;
  volume: VolumeOutline | null;
}) {
  const isInteractive = projectMode === "interactive";
  const reader = getReaderBody(chapter, projectMode);
  const hasReadableBody = Boolean(chapter?.official?.body || chapter?.draft?.body);
  const summary = chapter?.official?.summary ?? chapter?.summary ?? null;
  const readerSourceLabel = "阅读页";

  return (
    <div className="grid gap-5" id="chapter-reader">
      <ReaderPage
        className="interactive-reader-page max-w-none"
        footer={
          <span>
            {readerSourceLabel}
            {chapter ? ` · ${chapter.versionCount} 个版本 · 预计 ${chapter.estimatedWords} 字` : ""}
          </span>
        }
        title={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--gold-strong)]">
                {volume ? `第 ${volume.volumeNumber} 卷 · ${volume.title}` : "章节阅读区"}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-[var(--ink)]">
                {chapter ? `第 ${chapter.chapterNumber} 章 ${chapter.title}` : "准备开始阅读"}
              </h2>
            </div>
            <BookBadge tone={chapter?.official ? "success" : chapter?.draft ? "gold" : "paper"}>
              {chapter ? getChapterDisplayStatus(chapter, projectMode) : "待开启"}
            </BookBadge>
          </div>
        }
      >
        <div
          className={[
            "interactive-reader-prose whitespace-pre-wrap",
            hasReadableBody ? "" : "interactive-reader-empty",
          ].join(" ")}
        >
          {hasReadableBody ? (
            reader.body
          ) : (
            <div className="reader-empty-state">
              <p className="reader-empty-kicker">
                {chapter ? `第 ${chapter.chapterNumber} 章` : "阅读准备"}
              </p>
              <h3>{chapter ? "这一章尚未生成" : "准备开始阅读"}</h3>
              <p>{reader.body}</p>
            </div>
          )}
        </div>
        {isInteractive && chapter && hasReadableBody ? (
          <ChapterEndDecision
            chapterId={chapter.id}
            chapterNumber={chapter.chapterNumber}
            creditBalance={creditBalance ?? null}
            hasNextChapter={hasNextChapter}
            initialDecisionGeneration={chapter.decisionGeneration ?? null}
            initialDecision={chapter.decision ?? null}
            initialInteractiveState={interactiveState}
            initialStateChanges={chapter.stateChanges ?? null}
            key={chapter.id}
            nextChapterNumber={nextChapterNumber}
            projectId={projectId}
          />
        ) : null}
        {!isInteractive && chapter && hasReadableBody ? (
          <ChapterContinueAction
            creditBalance={creditBalance ?? null}
            hasNextChapter={hasNextChapter}
            nextChapterNumber={nextChapterNumber}
            projectId={projectId}
          />
        ) : null}
      </ReaderPage>

      {showBackmatter ? <ChapterBackmatter chapter={chapter} readerSource={reader.source} summary={summary} /> : null}
    </div>
  );
}

function ChapterBackmatter({
  chapter,
  readerSource,
  summary,
}: {
  chapter: WorkbenchChapter | null;
  readerSource: string;
  summary: ChapterSummary | null;
}) {
  return (
    <>
      {chapter ? (
        <PaperPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">章节大纲</h3>
            <SectionTabs
              activeId={readerSource}
              tabs={[
                { id: "正式稿", label: "正式稿", disabled: !chapter.official },
                { id: "草稿", label: "草稿", disabled: !chapter.draft },
                { id: "章节大纲", label: "大纲" },
              ]}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["事件", chapter.event],
              ["冲突", chapter.conflict],
              ["角色变化", chapter.characterChange],
              ["看点", chapter.highlight],
              ["伏笔", chapter.foreshadowing],
              ["结尾钩子", chapter.endingHook],
            ].map(([label, value]) => (
              <div
                className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3"
                key={label}
              >
                <p className="text-xs font-black text-[var(--gold-strong)]">{label}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{value}</p>
              </div>
            ))}
          </div>
        </PaperPanel>
      ) : null}
      <ChapterSummaryPanel summary={summary} />
      <ChapterQualityPanel chapter={chapter} />
    </>
  );
}

function ProjectReaderShellLayout({
  chapterGenerationSlot,
  chapters,
  creditBalance,
  currentChapter,
  interactiveState,
  project,
  projectMode,
  volume,
}: Pick<
  ProjectWorkbenchLayoutProps,
  | "chapterGenerationSlot"
  | "chapters"
  | "creditBalance"
  | "interactiveState"
  | "project"
  | "projectMode"
  | "volume"
> & {
  currentChapter: WorkbenchChapter | null;
}) {
  const isInteractive = projectMode === "interactive";
  const modeLabel = isInteractive ? "互动阅读" : "经典阅读";
  const creditLabel = isInteractive ? "星火" : "额度";
  const nextChapter = currentChapter
    ? chapters.find((chapter) => chapter.chapterNumber === currentChapter.chapterNumber + 1)
    : null;

  return (
    <section className="interactive-reader-shell">
      <aside className="interactive-reader-sidebar">
        <PaperPanel className="reader-sidebar-panel reader-sidebar-unified p-4">
          <div className="reader-sidebar-project">
            <div className="flex items-start gap-3">
              <div className="reader-sidebar-cover" aria-hidden="true">
                {project.title.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--gold-strong)]">{modeLabel}</p>
                <h1 className="mt-1 line-clamp-2 font-serif text-2xl font-black text-[var(--ink)]">
                  {project.title}
                </h1>
                <p className="mt-2 text-xs font-bold leading-5 text-[var(--muted)]">
                  {volume ? `第 ${volume.volumeNumber} 卷 · ${volume.title}` : project.status}
                </p>
              </div>
            </div>
            <div className="reader-sidebar-meta-grid">
              <div>
                <p className="reader-sidebar-meta-label">当前章节</p>
                <p className="reader-sidebar-meta-value">
                  {currentChapter
                    ? `第 ${currentChapter.chapterNumber} 章 · ${currentChapter.title}`
                    : "章节尚未铺开"}
                </p>
              </div>
              <div>
                <p className="reader-sidebar-meta-label">{creditLabel}</p>
                <CreditBadge balance={creditBalance} className="mt-1" label={creditLabel} />
              </div>
            </div>
          </div>
          {chapterGenerationSlot}
        </PaperPanel>
      </aside>
      <main className="interactive-reader-main">
        <ChapterReaderPreview
          chapter={currentChapter}
          creditBalance={creditBalance}
          hasNextChapter={Boolean(nextChapter)}
          interactiveState={interactiveState}
          nextChapterNumber={nextChapter?.chapterNumber ?? null}
          projectId={project.id}
          projectMode={projectMode}
          showBackmatter={false}
          volume={volume}
        />
      </main>
    </section>
  );
}

export function ProjectWorkbenchLayout({
  chapterGenerationSlot,
  chapters,
  creditBalance,
  currentChapterNumber,
  interactiveState,
  project,
  projectMode,
  volume,
}: ProjectWorkbenchLayoutProps) {
  const requestedChapter =
    typeof currentChapterNumber === "number"
      ? chapters.find((chapter) => chapter.chapterNumber === currentChapterNumber)
      : null;
  const currentChapter =
    requestedChapter ??
    chapters.find((chapter) => chapter.official?.body || chapter.draft?.body) ??
    chapters[0] ??
    null;
  return (
    <ProjectReaderShellLayout
      chapterGenerationSlot={chapterGenerationSlot}
      chapters={chapters}
      creditBalance={creditBalance}
      currentChapter={currentChapter}
      interactiveState={interactiveState}
      project={project}
      projectMode={projectMode}
      volume={volume}
    />
  );
}
