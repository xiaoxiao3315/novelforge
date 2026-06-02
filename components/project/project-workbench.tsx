import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChapterEndDecision,
  type NextChapterHint,
} from "@/components/project/chapter-end-decision";
import {
  BookBadge,
  CreditBadge,
  PaperPanel,
  ReaderPage,
  SectionTabs,
  StatusBookmark,
} from "@/components/ui/book";
import { DirectorConsole } from "@/components/ui/director-console";
import { PROJECT_MODE_LABELS, type ProjectMode } from "@/lib/projects/modes";
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

export type ConfigDisplayItem = {
  label: string;
  value: string;
};

type ProjectWorkbenchLayoutProps = {
  chapters: WorkbenchChapter[];
  configItems: ConfigDisplayItem[];
  creditBalance: number | null;
  directorSlot: ReactNode;
  extraIdeas: string | null;
  hasConfig: boolean;
  interactiveState: InteractiveStoryState | null;
  project: WorkbenchProject;
  projectMode: ProjectMode;
  volume: VolumeOutline | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatSummaryValue(value: string | string[]) {
  return Array.isArray(value) ? value.join("；") : value;
}

function getProjectModeTone(projectMode: ProjectMode) {
  return projectMode === "interactive" ? "warning" : "gold";
}

function getChapterStatus(chapter: WorkbenchChapter, projectMode: ProjectMode) {
  if (projectMode === "interactive") {
    if (chapter.official) {
      return "命运已定";
    }

    if (chapter.draft?.body) {
      return "可阅读";
    }

    return "待开启";
  }

  if (chapter.official) {
    return "正式稿";
  }

  if (chapter.draft?.body) {
    return "草稿";
  }

  return "未生成";
}

function getChapterCardId(chapterNumber: number) {
  return `chapter-card-${chapterNumber}`;
}

function getReaderSourceLabel(source: string, projectMode: ProjectMode) {
  if (projectMode !== "interactive") {
    return source;
  }

  if (source === "正式稿") {
    return "已确认篇章";
  }

  if (source === "草稿") {
    return "当前篇章";
  }

  if (source === "章节大纲") {
    return "本章脉络";
  }

  return source;
}

function getReaderBody(chapter: WorkbenchChapter | null) {
  if (!chapter) {
    return {
      body: "章节大纲生成后，正文会在这里像书页一样展开。",
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
    body: [
      `事件：${chapter.event}`,
      `冲突：${chapter.conflict}`,
      `角色变化：${chapter.characterChange}`,
      `看点：${chapter.highlight}`,
      `伏笔：${chapter.foreshadowing}`,
      `结尾钩子：${chapter.endingHook}`,
    ].join("\n\n"),
    source: "章节大纲",
  };
}

function ChapterToc({
  chapters,
  currentChapterId,
  projectMode,
}: {
  chapters: WorkbenchChapter[];
  currentChapterId?: string;
  projectMode: ProjectMode;
}) {
  if (chapters.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-6 text-[var(--muted)]">
        {projectMode === "interactive"
          ? "故事章节还没有浮现。铺开章节后，这里会成为你的命运入口。"
          : "还没有章节目录。生成章节大纲后，这里会显示第一卷目录。"}
      </div>
    );
  }

  return (
    <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
      {chapters.map((chapter) => {
        const isCurrent = chapter.id === currentChapterId;

        return (
          <a
            className={[
              "rounded-md border px-3 py-3 transition",
              isCurrent
                ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]"
                : "border-[var(--line)] bg-[rgba(255,248,234,0.58)] hover:border-[var(--gold)]",
            ].join(" ")}
            href="#chapter-reader"
            id={getChapterCardId(chapter.chapterNumber)}
            key={chapter.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--gold-strong)]">
                  第 {chapter.chapterNumber} 章
                </p>
                <p className="mt-1 line-clamp-2 font-bold leading-5 text-[var(--ink)]">
                  {chapter.title}
                </p>
              </div>
              <BookBadge tone={chapter.official ? "success" : chapter.draft ? "gold" : "paper"}>
                {getChapterStatus(chapter, projectMode)}
              </BookBadge>
            </div>
            <p className="mt-2 text-xs font-bold text-[var(--muted)]">
              {chapter.versionCount} 个版本 · 预计 {chapter.estimatedWords} 字
            </p>
          </a>
        );
      })}
    </div>
  );
}

function ChapterSummaryPanel({
  projectMode,
  summary,
}: {
  projectMode: ProjectMode;
  summary: ChapterSummary | null;
}) {
  const isInteractive = projectMode === "interactive";

  if (!summary) {
    return (
      <PaperPanel className="p-5">
        <h3 className="font-serif text-xl font-black text-[var(--ink)]">
          {isInteractive ? "故事回声" : "连续性状态"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {isInteractive
            ? "进入本章后，关键事件、羁绊、伏笔和下一章回声会在这里沉淀。"
            : "生成章节正文后，关键事件、关系变化、伏笔和下一章上下文会在这里沉淀。"}
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
      <h3 className="font-serif text-xl font-black text-[var(--ink)]">
        {isInteractive ? "故事回声" : "连续性状态"}
      </h3>
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

function hasInteractiveState(interactiveState: InteractiveStoryState | null) {
  if (!interactiveState) {
    return false;
  }

  return (
    Object.keys(interactiveState.relationships).length > 0 ||
    Object.keys(interactiveState.meters).length > 0 ||
    Object.keys(interactiveState.flags).length > 0 ||
    Object.keys(interactiveState.clues).length > 0 ||
    Object.keys(interactiveState.routeTendency).length > 0
  );
}

function StateValueGrid({
  emptyText = "还没有记录。",
  items,
  valueSuffix = "",
}: {
  emptyText?: string;
  items: Array<[string, boolean | number | string]>;
  valueSuffix?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {items.slice(0, 5).map(([name, value]) => (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2"
          key={name}
        >
          <span className="min-w-0 truncate text-xs font-bold text-[var(--ink)]">{name}</span>
          <span className="shrink-0 text-xs font-black text-[var(--gold-strong)]">
            {typeof value === "boolean" ? (value ? "已触发" : "未触发") : `${value}${valueSuffix}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function InteractiveStatePanel({
  interactiveState,
  projectMode,
}: {
  interactiveState: InteractiveStoryState | null;
  projectMode: ProjectMode;
}) {
  if (projectMode !== "interactive") {
    return null;
  }

  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-xl font-black text-[var(--ink)]">故事状态</h3>
        <BookBadge tone="warning">随章节生长</BookBadge>
      </div>
      {hasInteractiveState(interactiveState) && interactiveState ? (
        <div className="mt-4 grid gap-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            下一章会记住这些变化，让你的选择留下痕迹。
          </p>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">羁绊变化</p>
            <StateValueGrid
              emptyText="还没有角色羁绊被命运改写。"
              items={Object.entries(interactiveState.relationships)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">压力与风险</p>
            <StateValueGrid
              emptyText="压力和风险暂时平稳。"
              items={Object.entries(interactiveState.meters)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">被点亮的线索</p>
            <StateValueGrid
              emptyText="还没有线索被点亮。"
              items={Object.entries(interactiveState.clues)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">命运倾向</p>
            <StateValueGrid
              emptyText="命运倾向还没有成形。"
              items={Object.entries(interactiveState.routeTendency)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          你的故事状态还没有被命运改变。做出选择后，这里会沉淀羁绊、风险、线索和命运倾向。
        </p>
      )}
    </PaperPanel>
  );
}

function InteractiveFlowHint({ chapter }: { chapter: WorkbenchChapter | null }) {
  const steps = [
    {
      active: Boolean(chapter),
      label: "阅读本章",
      note: chapter ? `你正在进入第 ${chapter.chapterNumber} 章。` : "等待章节浮现。",
    },
    {
      active: Boolean(chapter?.draft?.body || chapter?.official?.body),
      label: "做出选择",
      note: "读完后会出现命运分歧。",
    },
    {
      active: Boolean(chapter?.decision?.selectedOptionId || chapter?.decision?.customChoice),
      label: "命运改变",
      note: "选择会改写关系、风险和线索。",
    },
    {
      active: Boolean(chapter?.decision?.selectedOptionId || chapter?.decision?.customChoice),
      label: "继续下一章",
      note: "下一章会沿用这条命运。",
    },
  ];

  return (
    <PaperPanel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase text-[var(--gold-strong)]">进入故事</p>
          <h3 className="mt-1 font-serif text-xl font-black text-[var(--ink)]">
            读章节 → 做选择 → 命运改变 → 继续下一章
          </h3>
        </div>
        {chapter ? <BookBadge tone="warning">正在阅读</BookBadge> : null}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div
            className={`rounded-md border px-3 py-3 ${
              step.active
                ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]"
                : "border-[var(--line)] bg-[rgba(255,248,234,0.58)]"
            }`}
            key={step.label}
          >
            <p className="text-xs font-black text-[var(--gold-strong)]">
              {index + 1}. {step.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.note}</p>
          </div>
        ))}
      </div>
    </PaperPanel>
  );
}

function ProjectBookHeader({
  creditBalance,
  project,
  projectMode,
}: {
  creditBalance: number | null;
  project: WorkbenchProject;
  projectMode: ProjectMode;
}) {
  const modeTone = getProjectModeTone(projectMode);
  const isInteractive = projectMode === "interactive";

  return (
    <section className="project-workbench-shell grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBookmark tone="gold">
            {isInteractive ? "Story Theater" : "Book Workbench"}
          </StatusBookmark>
          <BookBadge tone={modeTone}>{PROJECT_MODE_LABELS[projectMode]}</BookBadge>
        </div>
        <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
          {project.title}
        </h1>
        {isInteractive ? (
          <p className="mt-3 text-xs font-black uppercase text-[var(--gold-strong)]">
            进入故事
          </p>
        ) : null}
        <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
          {isInteractive
            ? project.description ||
              "读完章节，做出选择，故事会记住你的决定。"
            : project.description || "这本书暂未填写简介。"}
        </p>
        {isInteractive ? (
          <p className="mt-3 max-w-3xl rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.7)] px-3 py-2 text-sm leading-7 text-[var(--muted)]">
            读完章节，做出选择，故事会记住你的决定。
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="button-secondary" href="/dashboard">
            返回我的书架
          </Link>
          <Link className="button-secondary" href="/account/credits">
            {isInteractive ? "星火补给" : "点数钱包"}
          </Link>
        </div>
      </div>

      <PaperPanel className="p-5">
        <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
          {isInteractive ? "Theater Desk" : "Project Desk"}
        </p>
        <div className="mt-4 grid gap-4">
          <div>
            <p className="text-xs font-black text-[var(--muted)]">
              {isInteractive ? "剧场状态" : "作品状态"}
            </p>
            <BookBadge className="mt-2" tone="gold">
              {project.status}
            </BookBadge>
          </div>
          <div>
            <p className="text-xs font-black text-[var(--muted)]">最近翻阅</p>
            <p className="mt-1 font-bold text-[var(--ink)]">
              {formatDate(project.updated_at || project.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-[var(--muted)]">
              {isInteractive ? "当前星火" : "当前余额"}
            </p>
            <CreditBadge
              balance={creditBalance}
              className="mt-2"
              label={isInteractive ? "星火" : "点数"}
            />
          </div>
        </div>
      </PaperPanel>
    </section>
  );
}

function ChapterReaderPreview({
  chapter,
  chapters,
  interactiveState,
  projectId,
  projectMode,
  volume,
}: {
  chapter: WorkbenchChapter | null;
  chapters: WorkbenchChapter[];
  interactiveState: InteractiveStoryState | null;
  projectId: string;
  projectMode: ProjectMode;
  volume: VolumeOutline | null;
}) {
  const reader = getReaderBody(chapter);
  const summary = chapter?.official?.summary ?? chapter?.summary ?? null;
  const nextChapter = chapter
    ? chapters.find((item) => item.chapterNumber === chapter.chapterNumber + 1) ?? null
    : null;
  const nextChapterHint: NextChapterHint | null = nextChapter
    ? {
        anchorId: getChapterCardId(nextChapter.chapterNumber),
        chapterNumber: nextChapter.chapterNumber,
        hasBody: Boolean(nextChapter.official?.body || nextChapter.draft?.body),
        title: nextChapter.title,
      }
    : null;

  return (
    <div className="grid gap-5" id="chapter-reader">
      {projectMode === "interactive" ? <InteractiveFlowHint chapter={chapter} /> : null}
      <ReaderPage
        className="max-w-none"
        footer={
          <span>
            {getReaderSourceLabel(reader.source, projectMode)}
            {chapter ? ` · ${chapter.versionCount} 个版本 · 预计 ${chapter.estimatedWords} 字` : ""}
          </span>
        }
        title={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--gold-strong)]">
                {volume
                  ? `第 ${volume.volumeNumber} 卷 · ${volume.title}`
                  : projectMode === "interactive"
                    ? "当前篇章"
                    : "章节阅读区"}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-[var(--ink)]">
                {chapter ? `第 ${chapter.chapterNumber} 章 ${chapter.title}` : "等待章节大纲"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {projectMode === "interactive" && chapter ? (
                <BookBadge tone="warning">正在阅读</BookBadge>
              ) : null}
              <BookBadge tone={chapter?.official ? "success" : chapter?.draft ? "gold" : "paper"}>
                {chapter ? getChapterStatus(chapter, projectMode) : projectMode === "interactive" ? "待开启" : "未生成"}
              </BookBadge>
            </div>
          </div>
        }
      >
        <div className="whitespace-pre-wrap">{reader.body}</div>
        {projectMode === "interactive" && chapter ? (
          <ChapterEndDecision
            chapterId={chapter.id}
            chapterNumber={chapter.chapterNumber}
            initialDecision={chapter.decision ?? null}
            initialInteractiveState={interactiveState}
            initialStateChanges={chapter.stateChanges ?? null}
            nextChapter={nextChapterHint}
            projectId={projectId}
          />
        ) : null}
      </ReaderPage>

      {chapter ? (
        <PaperPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">
              {projectMode === "interactive" ? "本章脉络" : "章节大纲"}
            </h3>
            <SectionTabs
              activeId={reader.source}
              tabs={[
                {
                  id: "正式稿",
                  label: projectMode === "interactive" ? "已确认篇章" : "正式稿",
                  disabled: !chapter.official,
                },
                {
                  id: "草稿",
                  label: projectMode === "interactive" ? "当前篇章" : "草稿",
                  disabled: !chapter.draft,
                },
                { id: "章节大纲", label: projectMode === "interactive" ? "脉络" : "大纲" },
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

      <ChapterSummaryPanel projectMode={projectMode} summary={summary} />
    </div>
  );
}

export function ProjectWorkbenchLayout({
  chapters,
  configItems,
  creditBalance,
  directorSlot,
  extraIdeas,
  hasConfig,
  interactiveState,
  project,
  projectMode,
  volume,
}: ProjectWorkbenchLayoutProps) {
  const currentChapter =
    chapters.find((chapter) => chapter.official?.body || chapter.draft?.body) ?? chapters[0] ?? null;

  return (
    <>
      <ProjectBookHeader
        creditBalance={creditBalance}
        project={project}
        projectMode={projectMode}
      />

      <section className="project-workbench-shell project-workbench-grid">
        <aside className="project-sidebar-column grid gap-5 xl:sticky xl:top-6">
          <PaperPanel className="p-5">
            <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
              {projectMode === "interactive" ? "Story Index" : "Book Index"}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-black text-[var(--ink)]">作品目录</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
                <p className="text-xs font-black text-[var(--muted)]">模式</p>
                <BookBadge className="mt-2" tone={getProjectModeTone(projectMode)}>
                  {PROJECT_MODE_LABELS[projectMode]}
                </BookBadge>
              </div>
              {volume ? (
                <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
                  <p className="text-xs font-black text-[var(--muted)]">当前卷</p>
                  <p className="mt-1 font-bold leading-6 text-[var(--ink)]">{volume.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{chapters.length} 章</p>
                </div>
              ) : null}
            </div>
          </PaperPanel>

          <PaperPanel className="p-5">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">章节目录</h3>
            <div className="mt-4">
              <ChapterToc
                chapters={chapters}
                currentChapterId={currentChapter?.id}
                projectMode={projectMode}
              />
            </div>
          </PaperPanel>

          <InteractiveStatePanel
            interactiveState={interactiveState}
            projectMode={projectMode}
          />

          <PaperPanel className="p-5">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">剧情筛选器</h3>
            {hasConfig ? (
              <>
                <div className="mt-4 grid gap-2">
                  {configItems.map((item) => (
                    <div
                      className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2"
                      key={item.label}
                    >
                      <p className="text-xs font-black text-[var(--gold-strong)]">{item.label}</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-[var(--ink)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3 text-sm leading-7 text-[var(--muted)]">
                  {extraIdeas || "暂无补充想法。"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                未找到剧情筛选器配置，不能生成作品设定。
              </p>
            )}
          </PaperPanel>
        </aside>

        <main className="project-reader-column min-w-0">
          <ChapterReaderPreview
            chapter={currentChapter}
            chapters={chapters}
            interactiveState={interactiveState}
            projectId={project.id}
            projectMode={projectMode}
            volume={volume}
          />
        </main>

        <aside className="project-director-column xl:sticky xl:top-6" id="story-director">
          <DirectorConsole
            collapsedLabel="展开导演台"
            defaultOpen
            eyebrow={projectMode === "interactive" ? "Story Director" : "AI Director"}
            title={projectMode === "interactive" ? "故事导演台" : "AI 导演台"}
          >
            <div className="mb-4 grid gap-3">
              <p className="text-sm leading-7 text-[var(--muted)]">
                {projectMode === "interactive"
                  ? "在这里给本章定调：本章意图、必须发生、不要发生和结尾氛围。进入下一章前，故事会沿用上一章选择和当前状态。"
                  : "生成设定、故事圣经、大纲、章节正文和正式稿确认仍使用原有入口；收起导演台后，中央书页会保持完整阅读宽度。"}
              </p>
              <CreditBadge
                balance={creditBalance}
                label={projectMode === "interactive" ? "当前星火" : "当前点数"}
              />
            </div>
            <div className="grid gap-5">{directorSlot}</div>
          </DirectorConsole>
        </aside>
      </section>
    </>
  );
}
