import Link from "next/link";
import type { ReactNode } from "react";
import { ChapterEndDecision } from "@/components/project/chapter-end-decision";
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

function getProjectModeTone(projectMode: ProjectMode) {
  return projectMode === "interactive" ? "warning" : "gold";
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
}: {
  chapters: WorkbenchChapter[];
  currentChapterId?: string;
}) {
  if (chapters.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-6 text-[var(--muted)]">
        还没有章节目录。生成章节大纲后，这里会显示第一卷目录。
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
                {getChapterStatus(chapter)}
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
  items,
  valueSuffix = "",
}: {
  items: Array<[string, boolean | number | string]>;
  valueSuffix?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-[var(--muted)]">还没有记录。</p>;
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
            下一章生成会读取这些状态，让选择留下痕迹。
          </p>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">人物羁绊</p>
            <StateValueGrid items={Object.entries(interactiveState.relationships)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">压力与风险</p>
            <StateValueGrid items={Object.entries(interactiveState.meters)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">线索与倾向</p>
            <StateValueGrid
              items={[
                ...Object.entries(interactiveState.clues),
                ...Object.entries(interactiveState.routeTendency),
              ]}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          做出命运分歧后，这里会沉淀关系、压力、线索和故事倾向。
        </p>
      )}
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
  const headerCopy = isInteractive
    ? {
        desk: "Theater Desk",
        entry: "进入故事",
        kicker: "读完章节，做出选择，故事会记住你的决定。",
        returnLabel: "返回我的故事",
        supplyLabel: "星火补给",
        balanceLabel: "当前星火",
        flow: ["阅读本章", "做出选择", "命运改变", "继续下一章"],
      }
    : {
        desk: "Writing Desk",
        entry: "创作书桌",
        kicker: "整理设定、大纲和章节正文，稳稳推进这本小说。",
        returnLabel: "返回我的故事",
        supplyLabel: "创作补给",
        balanceLabel: "当前额度",
        flow: ["作品设定", "故事圣经", "章节大纲", "正文成稿"],
      };

  return (
    <section className="project-workbench-shell project-hero-grid py-8">
      <div className="project-hero-card">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBookmark tone="gold">
            {isInteractive ? "Story Theater" : "Book Workbench"}
          </StatusBookmark>
          <BookBadge tone={modeTone}>{PROJECT_MODE_LABELS[projectMode]}</BookBadge>
        </div>
        <p className="mt-8 text-sm font-black uppercase text-[var(--gold-strong)]">
          {headerCopy.entry}
        </p>
        <h1 className="mt-3 font-serif text-5xl font-black leading-tight text-[var(--ink)]">
          {project.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-9 text-[var(--muted)]">
          {project.description || "这本书暂未填写简介。"}
        </p>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[var(--ink-soft)]">
          {headerCopy.kicker}
        </p>
        <div className="project-hero-flow mt-5" aria-label={isInteractive ? "互动故事流程" : "创作流程"}>
          {headerCopy.flow.map((step, index) => (
            <span className="project-hero-flow-step" key={step}>
              <span className="project-hero-flow-index">{index + 1}</span>
              {step}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="button-secondary" href="/dashboard">
            {headerCopy.returnLabel}
          </Link>
          <Link className="button-secondary" href="/account/credits">
            {headerCopy.supplyLabel}
          </Link>
        </div>
      </div>

      <PaperPanel className="project-hero-ledger p-5">
        <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
          {headerCopy.desk}
        </p>
        <div className="mt-4 grid gap-4">
          <div>
            <p className="text-xs font-black text-[var(--muted)]">
              {isInteractive ? "故事状态" : "作品状态"}
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
            <p className="text-xs font-black text-[var(--muted)]">{headerCopy.balanceLabel}</p>
            <CreditBadge
              balance={creditBalance}
              className="mt-2"
              label={isInteractive ? "星火" : "额度"}
            />
          </div>
        </div>
      </PaperPanel>
    </section>
  );
}

function ChapterReaderPreview({
  chapter,
  interactiveState,
  projectId,
  projectMode,
  volume,
}: {
  chapter: WorkbenchChapter | null;
  interactiveState: InteractiveStoryState | null;
  projectId: string;
  projectMode: ProjectMode;
  volume: VolumeOutline | null;
}) {
  const reader = getReaderBody(chapter);
  const summary = chapter?.official?.summary ?? chapter?.summary ?? null;
  const isInteractive = projectMode === "interactive";

  return (
    <div className="grid gap-5" id="chapter-reader">
      {isInteractive ? (
        <div className="story-flow-strip" aria-label="互动故事流程">
          {["阅读本章", "做出选择", "命运改变", "继续下一章"].map((step, index) => (
            <span className="story-flow-step" key={step}>
              <span className="story-flow-index">{index + 1}</span>
              {step}
            </span>
          ))}
        </div>
      ) : null}
      <ReaderPage
        className={isInteractive ? "story-theater-reader max-w-none" : "max-w-none"}
        footer={
          <span>
            {reader.source}
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
                {chapter ? `第 ${chapter.chapterNumber} 章 ${chapter.title}` : "等待章节大纲"}
              </h2>
            </div>
            <BookBadge tone={chapter?.official ? "success" : chapter?.draft ? "gold" : "paper"}>
              {chapter ? getChapterStatus(chapter) : "未生成"}
            </BookBadge>
          </div>
        }
      >
        <div className="whitespace-pre-wrap">{reader.body}</div>
        {isInteractive && chapter ? (
          <ChapterEndDecision
            chapterId={chapter.id}
            chapterNumber={chapter.chapterNumber}
            initialDecision={chapter.decision ?? null}
            initialInteractiveState={interactiveState}
            initialStateChanges={chapter.stateChanges ?? null}
            projectId={projectId}
          />
        ) : null}
      </ReaderPage>

      {chapter ? (
        <PaperPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">章节大纲</h3>
            <SectionTabs
              activeId={reader.source}
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
              {projectMode === "interactive" ? "Destiny Book" : "Book Index"}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-black text-[var(--ink)]">
              {projectMode === "interactive" ? "命运之书" : "作品目录"}
            </h2>
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
              <a className="button-secondary min-h-10 px-3 text-sm" href="#chapter-reader">
                {projectMode === "interactive" ? "进入故事" : "进入章节"}
              </a>
            </div>
          </PaperPanel>

          <PaperPanel className="p-5">
            <h3 className="font-serif text-xl font-black text-[var(--ink)]">章节目录</h3>
            <div className="mt-4">
              <ChapterToc chapters={chapters} currentChapterId={currentChapter?.id} />
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

        <main className="project-reader-column project-reader-stage min-w-0">
          <ChapterReaderPreview
            chapter={currentChapter}
            interactiveState={interactiveState}
            projectId={project.id}
            projectMode={projectMode}
            volume={volume}
          />
        </main>

        <aside className="project-director-column xl:sticky xl:top-6">
          <DirectorConsole
            collapsedLabel="展开导演台"
            defaultOpen
            eyebrow={projectMode === "interactive" ? "Story Director" : "AI Director"}
            title={projectMode === "interactive" ? "故事导演台" : "AI 导演台"}
          >
            <div className="mb-4 grid gap-3">
              <p className="text-sm leading-7 text-[var(--muted)]">
                {projectMode === "interactive"
                  ? "设定、故事圣经、大纲与章节入口仍在这里；进入下一章前，会沿用上一章选择和当前故事状态。"
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
