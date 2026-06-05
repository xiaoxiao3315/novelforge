"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENERATION_CREDIT_COSTS } from "@/lib/credits";
import type { ProjectMode } from "@/lib/projects/modes";
import { formatUserFacingError } from "@/lib/ui/errors";
import {
  CHAPTER_INTERVENTION_LIMITS,
  EMPTY_CHAPTER_INTERVENTION,
  type ChapterContent,
  type ChapterIntervention,
} from "@/prompts/chapter";
import type { ChapterOutline, VolumeOutline } from "@/prompts/outline";

type ChapterDisplay = ChapterContent & {
  id?: string;
  needsRegeneration?: boolean;
  stale?: boolean;
};

type OutlineGeneratorProps = {
  projectId: string;
  initialVolume: VolumeOutline | null;
  initialChapters: ChapterDisplay[];
  hasPrerequisites: boolean;
  creditBalance: number | null;
  projectMode: ProjectMode;
  currentChapterNumber?: number | null;
  setupStatus?: {
    hasBible: boolean;
    hasCharacters: boolean;
    hasConcept: boolean;
  };
  variant?: "full" | "readerSidebar";
};

type OutlineResponse = {
  volume?: VolumeOutline;
  chapters?: ChapterOutline[];
  error?: string;
};

type ChapterResponse = {
  chapterId?: string;
  chapter?: ChapterContent;
  error?: string;
};

type GenerationSetupResponse = {
  error?: string;
};

type ChapterQualityMode = "normal" | "quality";

type SetOfficialResponse = {
  chapterId?: string;
  versionId?: string;
  official?: NonNullable<ChapterContent["official"]>;
  error?: string;
};

type BatchGenerationProgress = {
  completed: number;
  currentChapterNumber: number | null;
  message: string;
  skipped: number;
  status: "idle" | "running" | "success" | "failed";
  total: number;
};

type BatchChapterRequestMetadata = {
  batchRunId: string;
  generationSource: "batch-20";
  routeMode: "default";
  routeRevision: string;
  routeSnapshotHash: string;
};

type OutlineRequestOptions = {
  chapterCount?: number;
  maxChapterNumber?: number;
  startChapterNumber?: number;
  volumeNumber?: number;
};

type OutlineRequestStateOptions = {
  baseChapters?: ChapterDisplay[];
  mergeChapters?: boolean;
};

const BATCH_CHAPTER_LIMIT = 20;
const emptyBatchProgress: BatchGenerationProgress = {
  completed: 0,
  currentChapterNumber: null,
  message: "",
  skipped: 0,
  status: "idle",
  total: 0,
};

const volumeSections: Array<{
  key: keyof Omit<VolumeOutline, "volumeNumber" | "title">;
  label: string;
}> = [
  { key: "summary", label: "卷摘要" },
  { key: "mainConflict", label: "卷主线冲突" },
  { key: "endingHook", label: "卷结尾钩子" },
];

const chapterSections: Array<{
  key: keyof Omit<ChapterOutline, "chapterNumber" | "title" | "estimatedWords">;
  label: string;
}> = [
  { key: "event", label: "本章事件" },
  { key: "conflict", label: "本章冲突" },
  { key: "characterChange", label: "角色变化" },
  { key: "highlight", label: "爽点 / 看点" },
  { key: "foreshadowing", label: "伏笔" },
  { key: "endingHook", label: "结尾钩子" },
];

const summarySections: Array<{
  key: keyof NonNullable<ChapterContent["summary"]>;
  label: string;
}> = [
  { key: "keyEvents", label: "关键事件" },
  { key: "characterStateChanges", label: "角色状态变化" },
  { key: "relationshipChanges", label: "关系变化" },
  { key: "foreshadowingAndClues", label: "伏笔和线索" },
  { key: "unresolvedQuestions", label: "未解决悬念" },
  { key: "endingState", label: "结尾状态" },
  { key: "continuityNotes", label: "下一章上下文" },
];

const chapterQualityOptions: Array<{
  mode: ChapterQualityMode;
  label: string;
  buttonLabel: string;
  description: string;
}> = [
  {
    mode: "normal",
    label: "普通生成",
    buttonLabel: "快速生成",
    description: "快速生成章节正文，适合草稿推进。",
  },
  {
    mode: "quality",
    label: "高质量生成",
    buttonLabel: "精修生成",
    description: "先产出初稿，再进行 AI 审稿与按需修订，耗时更久，适合正式章节。",
  },
];

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

type ChapterQualityMetadata = NonNullable<NonNullable<ChapterDisplay["draft"]>["quality"]>;

function formatSummaryValue(value: string | string[]) {
  return Array.isArray(value) ? value.join("；") : value;
}

function getChapterGenerationCost(mode: ChapterQualityMode) {
  return mode === "quality"
    ? GENERATION_CREDIT_COSTS.generate_chapter_quality
    : GENERATION_CREDIT_COSTS.generate_chapter;
}

function formatModeCreditShortfall(balance: number, cost: number, isInteractive: boolean) {
  const shortage = Math.max(cost - balance, 0);
  const creditUnit = isInteractive ? "星火" : "额度";

  return `${creditUnit}不足：当前 ${balance} ${creditUnit}，本次操作需要 ${cost} ${creditUnit}，还差 ${shortage} ${creditUnit}。`;
}

const interventionFields: Array<{
  key: keyof ChapterIntervention;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "directorInstruction",
    label: "导演指令",
    placeholder: "这一章要更热血，让主角第一次意识到能力有代价。",
    rows: 3,
  },
  {
    key: "styleFocus",
    label: "风格倾向",
    placeholder: "热血 / 悬疑 / 黑暗 / 情感 / 打斗 / 快节奏 / 细腻",
    rows: 2,
  },
  {
    key: "mustInclude",
    label: "本章必须出现",
    placeholder: "妹妹的旧照片、黑色灵纹失控、监察官的试探",
    rows: 2,
  },
  {
    key: "mustAvoid",
    label: "本章不能出现",
    placeholder: "不要提前揭露最终反派身份，不要让女主突然表白",
    rows: 2,
  },
  {
    key: "endingRequirement",
    label: "结尾要求",
    placeholder: "结尾留下主角记忆缺失的悬念",
    rows: 2,
  },
];

function chapterKey(chapter: Pick<ChapterDisplay, "chapterNumber">) {
  return String(chapter.chapterNumber);
}

function chapterNeedsRegeneration(chapter: ChapterDisplay | null | undefined) {
  return Boolean(chapter?.needsRegeneration || chapter?.stale);
}

function hasReadableChapterBody(chapter: ChapterDisplay | null | undefined) {
  return Boolean(
    chapter &&
      !chapterNeedsRegeneration(chapter) &&
      (chapter.official?.body || chapter.draft?.body),
  );
}

function getBatchStartChapterNumber(
  chapters: ChapterDisplay[],
  currentChapterNumber?: number | null,
) {
  if (typeof currentChapterNumber === "number") {
    return currentChapterNumber + 1;
  }

  return chapters[0]?.chapterNumber ?? 1;
}

function getBatchDesiredChapterNumbers(
  chapters: ChapterDisplay[],
  currentChapterNumber?: number | null,
) {
  const startChapterNumber = getBatchStartChapterNumber(chapters, currentChapterNumber);

  return Array.from(
    { length: BATCH_CHAPTER_LIMIT },
    (_, index) => startChapterNumber + index,
  );
}

function getBatchTargetChapters(
  chapters: ChapterDisplay[],
  currentChapterNumber?: number | null,
) {
  const chapterByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));

  return getBatchDesiredChapterNumbers(chapters, currentChapterNumber)
    .map((chapterNumber) => chapterByNumber.get(chapterNumber))
    .filter((chapter): chapter is ChapterDisplay => Boolean(chapter))
    .filter((chapter) => !hasReadableChapterBody(chapter));
}

function getMissingBatchOutlineRanges(
  chapters: ChapterDisplay[],
  currentChapterNumber?: number | null,
) {
  const existingChapterNumbers = new Set(chapters.map((chapter) => chapter.chapterNumber));
  const missingChapterNumbers = getBatchDesiredChapterNumbers(
    chapters,
    currentChapterNumber,
  ).filter((chapterNumber) => !existingChapterNumbers.has(chapterNumber));
  const volumeNumbers = new Set(
    missingChapterNumbers.map((chapterNumber) => Math.ceil(chapterNumber / BATCH_CHAPTER_LIMIT)),
  );

  return [...volumeNumbers]
    .sort((left, right) => left - right)
    .map((volumeNumber) => ({
      chapterCount: BATCH_CHAPTER_LIMIT,
      startChapterNumber: (volumeNumber - 1) * BATCH_CHAPTER_LIMIT + 1,
      volumeNumber,
    }));
}

function getEstimatedBatchChapterCount(
  chapters: ChapterDisplay[],
  currentChapterNumber?: number | null,
) {
  const chapterByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));

  return getBatchDesiredChapterNumbers(chapters, currentChapterNumber).filter((chapterNumber) => {
    const chapter = chapterByNumber.get(chapterNumber);

    return !chapter || !hasReadableChapterBody(chapter);
  }).length;
}

function mergeChapterLists(
  currentChapters: ChapterDisplay[],
  incomingChapters: ChapterDisplay[],
) {
  const chapterMap = new Map<number, ChapterDisplay>();

  for (const chapter of currentChapters) {
    chapterMap.set(chapter.chapterNumber, chapter);
  }

  for (const chapter of incomingChapters) {
    const existingChapter = chapterMap.get(chapter.chapterNumber);

    chapterMap.set(
      chapter.chapterNumber,
      existingChapter
        ? {
            ...existingChapter,
            ...chapter,
            decision: existingChapter.decision,
            decisionGeneration: existingChapter.decisionGeneration,
            draft: existingChapter.draft,
            id: existingChapter.id,
            official: existingChapter.official,
            stateChanges: existingChapter.stateChanges,
            summary: existingChapter.summary,
            versionCount: existingChapter.versionCount,
          }
        : chapter,
    );
  }

  return [...chapterMap.values()].sort((left, right) => left.chapterNumber - right.chapterNumber);
}

function getInitialInterventions(chapters: ChapterDisplay[]) {
  return Object.fromEntries(
    chapters.map((chapter) => [
      chapterKey(chapter),
      chapter.draft?.intervention ?? { ...EMPTY_CHAPTER_INTERVENTION },
    ]),
  ) as Record<string, ChapterIntervention>;
}

function getInitialQualityModes(chapters: ChapterDisplay[]) {
  return Object.fromEntries(
    chapters.map((chapter) => [chapterKey(chapter), "normal"]),
  ) as Record<string, ChapterQualityMode>;
}

function getQualityScoreItems(chapter: ChapterDisplay) {
  const scores = chapter.draft?.quality?.critique?.scores;

  return qualityScoreLabels.map(([key, label]) => {
    const value = scores?.[key];

    return {
      key,
      label,
      value: typeof value === "number" ? value : null,
    };
  });
}

function formatQualityPipelineStatus(quality: ChapterQualityMetadata) {
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

function formatRewriteStatus(quality: ChapterQualityMetadata) {
  if (quality.rewriteApplied === true) {
    return "已执行精修";
  }

  if (quality.rewriteApplied === false) {
    return "未执行精修：初稿评分已达标";
  }

  return "--";
}

export function OutlineGenerator({
  projectId,
  initialVolume,
  initialChapters,
  hasPrerequisites,
  creditBalance,
  projectMode,
  currentChapterNumber,
  setupStatus,
  variant = "full",
}: OutlineGeneratorProps) {
  const [volume, setVolume] = useState(initialVolume);
  const [chapters, setChapters] = useState(initialChapters);
  const [interventions, setInterventions] = useState(() =>
    getInitialInterventions(initialChapters),
  );
  const [qualityModes, setQualityModes] = useState(() =>
    getInitialQualityModes(initialChapters),
  );
  const [error, setError] = useState("");
  const [setupStep, setSetupStep] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] =
    useState<BatchGenerationProgress>(emptyBatchProgress);
  const [generatingChapterNumber, setGeneratingChapterNumber] = useState<number | null>(null);
  const [settingOfficialChapterNumber, setSettingOfficialChapterNumber] = useState<number | null>(
    null,
  );
  const router = useRouter();
  const conceptCost = GENERATION_CREDIT_COSTS.generate_concept;
  const bibleCost = GENERATION_CREDIT_COSTS.generate_bible;
  const outlineCost = GENERATION_CREDIT_COSTS.generate_outline;
  const chapterCost = GENERATION_CREDIT_COSTS.generate_chapter;
  const isInteractive = projectMode === "interactive";
  const isReaderSidebar = variant === "readerSidebar";
  const shouldBootstrapFirstChapter = isReaderSidebar;
  const readerBootstrapCost = outlineCost + chapterCost;
  const effectiveSetupStatus = setupStatus ?? {
    hasBible: hasPrerequisites,
    hasCharacters: hasPrerequisites,
    hasConcept: hasPrerequisites,
  };
  const needsConcept = !effectiveSetupStatus.hasConcept;
  const needsBible = !effectiveSetupStatus.hasBible || !effectiveSetupStatus.hasCharacters;
  const readerSetupCost =
    (needsConcept ? conceptCost : 0) +
    (needsBible ? bibleCost : 0) +
    readerBootstrapCost;
  const creditUnit = isInteractive ? "星火" : "额度";
  const hasEnoughOutlineCredits = creditBalance === null || creditBalance >= outlineCost;
  const hasEnoughChapterCredits = creditBalance === null || creditBalance >= chapterCost;
  const hasEnoughReaderBootstrapCredits =
    creditBalance === null || creditBalance >= readerBootstrapCost;
  const hasEnoughReaderSetupCredits =
    creditBalance === null || creditBalance >= readerSetupCost;
  const outlineCreditShortfallMessage =
    creditBalance === null || hasEnoughOutlineCredits
      ? ""
      : formatModeCreditShortfall(creditBalance, outlineCost, isInteractive);
  const chapterCreditShortfallMessage =
    creditBalance === null || hasEnoughChapterCredits
      ? ""
      : formatModeCreditShortfall(creditBalance, chapterCost, isInteractive);
  const readerBootstrapCreditShortfallMessage =
    creditBalance === null || hasEnoughReaderBootstrapCredits
      ? ""
      : formatModeCreditShortfall(creditBalance, readerBootstrapCost, isInteractive);
  const readerSetupCreditShortfallMessage =
    creditBalance === null || hasEnoughReaderSetupCredits
      ? ""
      : formatModeCreditShortfall(creditBalance, readerSetupCost, isInteractive);

  async function runSetupRequest(endpoint: string, fallbackError: string) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    });
    const payload = (await response.json().catch(() => null)) as GenerationSetupResponse | null;

    if (!response.ok) {
      setError(formatUserFacingError(payload?.error, fallbackError));
      return false;
    }

    return true;
  }

  async function requestOutline(
    fallbackError: string,
    outlineOptions: OutlineRequestOptions = {},
    stateOptions: OutlineRequestStateOptions = {},
  ) {
    const response = await fetch("/api/generate/outline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        ...outlineOptions,
      }),
    });

    const payload = (await response.json().catch(() => null)) as OutlineResponse | null;

    if (!response.ok || !payload?.volume || !payload.chapters) {
      setError(formatUserFacingError(payload?.error, fallbackError));
      return null;
    }

    const nextChapters = stateOptions.mergeChapters
      ? mergeChapterLists(stateOptions.baseChapters ?? chapters, payload.chapters)
      : payload.chapters;

    if (!stateOptions.mergeChapters) {
      setVolume(payload.volume);
    }
    setChapters(nextChapters);
    setInterventions(getInitialInterventions(nextChapters));
    setQualityModes(getInitialQualityModes(nextChapters));

    return {
      chapters: nextChapters,
      volume: payload.volume,
    };
  }

  async function generateReaderSetup() {
    if (hasPrerequisites) {
      await generateOutline();
      return;
    }

    if (!hasEnoughReaderSetupCredits) {
      setError(readerSetupCreditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    if (needsConcept) {
      setSetupStep("正在准备作品设定...");
      const conceptReady = await runSetupRequest(
        "/api/generate/concept",
        "作品设定生成失败，请稍后重试。",
      );

      if (!conceptReady) {
        setIsGenerating(false);
        setSetupStep("");
        router.refresh();
        return;
      }
    }

    if (needsBible) {
      setSetupStep("正在准备故事资料...");
      const bibleReady = await runSetupRequest(
        "/api/generate/bible",
        "故事资料生成失败，请稍后重试。",
      );

      if (!bibleReady) {
        setIsGenerating(false);
        setSetupStep("");
        router.refresh();
        return;
      }
    }

    await generateOutline({ prerequisitesReady: true });
  }

  async function generateOutline(options: { prerequisitesReady?: boolean } = {}) {
    const prerequisitesReady = options.prerequisitesReady ?? hasPrerequisites;

    if (!prerequisitesReady) {
      setIsGenerating(false);
      setSetupStep("");
      setError("请先完成作品设定、故事圣经和角色卡。");
      return;
    }

    if (shouldBootstrapFirstChapter && !hasEnoughReaderBootstrapCredits) {
      setIsGenerating(false);
      setSetupStep("");
      setError(readerBootstrapCreditShortfallMessage);
      return;
    }

    if (!shouldBootstrapFirstChapter && !hasEnoughOutlineCredits) {
      setIsGenerating(false);
      setSetupStep("");
      setError(outlineCreditShortfallMessage);
      return;
    }

    setError("");
    setSetupStep(shouldBootstrapFirstChapter ? "正在铺开章节目录..." : "");
    setIsGenerating(true);

    const outlinePayload = await requestOutline("章节大纲生成失败，请稍后重试。");

    if (!outlinePayload) {
      setIsGenerating(false);
      setSetupStep("");
      return;
    }

    if (shouldBootstrapFirstChapter) {
      const firstChapter =
        outlinePayload.chapters.find((chapter) => chapter.chapterNumber === 1) ??
        outlinePayload.chapters[0];

      if (!firstChapter) {
        setIsGenerating(false);
        setSetupStep("");
        router.refresh();
        return;
      }

      setSetupStep("正在生成第 1 章正文...");
      await generateChapter(firstChapter, {
        navigateToChapter: true,
        qualityMode: "normal",
      });
      setIsGenerating(false);
      setSetupStep("");
      return;
    }

    setIsGenerating(false);
    setSetupStep("");
    router.refresh();
  }

  async function generateChapter(
    chapter: ChapterDisplay,
    options: {
      batchMetadata?: BatchChapterRequestMetadata;
      navigateToChapter?: boolean;
      qualityMode?: ChapterQualityMode;
      refresh?: boolean;
    } = {},
  ) {
    const selectedQualityMode = options.qualityMode ?? qualityModes[chapterKey(chapter)] ?? "normal";
    const selectedChapterCost = getChapterGenerationCost(selectedQualityMode);
    const hasEnoughSelectedChapterCredits =
      creditBalance === null || creditBalance >= selectedChapterCost;
    const selectedChapterCreditShortfallMessage =
      creditBalance === null || hasEnoughSelectedChapterCredits
        ? ""
        : formatModeCreditShortfall(creditBalance, selectedChapterCost, isInteractive);

    if (!hasEnoughSelectedChapterCredits) {
      setError(selectedChapterCreditShortfallMessage);
      return null;
    }

    setError("");
    setGeneratingChapterNumber(chapter.chapterNumber);
    const currentIntervention =
      interventions[chapterKey(chapter)] ?? { ...EMPTY_CHAPTER_INTERVENTION };

    const response = await fetch("/api/generate/chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        intervention: currentIntervention,
        ...options.batchMetadata,
        qualityMode: selectedQualityMode,
      }),
    });

    const payload = (await response.json().catch(() => null)) as ChapterResponse | null;

    setGeneratingChapterNumber(null);

    if (!response.ok || !payload?.chapter) {
      setError(
        formatUserFacingError(
          payload?.error,
          isInteractive ? "进入本章失败，请稍后重试。" : "章节正文生成失败，请稍后重试。",
        ),
      );
      return null;
    }

    const generatedChapter = {
      ...payload.chapter,
      id: payload.chapterId || chapter.id,
    };

    setInterventions((currentInterventions) => ({
      ...currentInterventions,
      [chapterKey(generatedChapter)]:
        generatedChapter.draft?.intervention ?? currentIntervention,
    }));
    setChapters((currentChapters) =>
      currentChapters.map((currentChapter) =>
        currentChapter.chapterNumber === generatedChapter.chapterNumber
          ? generatedChapter
          : currentChapter,
      ),
    );
    if (options.navigateToChapter) {
      router.push(`/project/${projectId}?chapter=${generatedChapter.chapterNumber}#chapter-reader`);
    }
    if (options.refresh ?? true) {
      router.refresh();
    }
    return generatedChapter;
  }

  async function generateBatchChapters() {
    if (!hasPrerequisites) {
      setError("请先完成作品设定、故事圣经和角色卡。");
      return;
    }

    if (isBatchGenerating || isGenerating || generatingChapterNumber !== null) {
      return;
    }

    const initialMissingOutlineRanges = getMissingBatchOutlineRanges(
      chapters,
      currentChapterNumber,
    );
    const needsOutline = initialMissingOutlineRanges.length > 0;
    const estimatedChapterCount = getEstimatedBatchChapterCount(chapters, currentChapterNumber);
    const minimumCost =
      outlineCost * initialMissingOutlineRanges.length + chapterCost * estimatedChapterCount;
    const hasEnoughBatchStartCredits = creditBalance === null || creditBalance >= minimumCost;

    if (!hasEnoughBatchStartCredits) {
      setError(formatModeCreditShortfall(creditBalance ?? 0, minimumCost, isInteractive));
      return;
    }

    setError("");
    setIsBatchGenerating(true);
    setBatchProgress({
      ...emptyBatchProgress,
      message: needsOutline ? "正在铺开章节目录..." : "正在准备预生成队列...",
      status: "running",
    });

    try {
      let workingChapters = chapters;

      for (const [index, range] of initialMissingOutlineRanges.entries()) {
        setSetupStep(`正在补齐第 ${range.startChapterNumber} 章起的大纲...`);
        setBatchProgress({
          ...emptyBatchProgress,
          message: `正在补齐大纲 ${index + 1}/${initialMissingOutlineRanges.length}...`,
          status: "running",
        });

        const outlinePayload = await requestOutline(
          "章节目录生成失败，请稍后重试。",
          {
            chapterCount: range.chapterCount,
            startChapterNumber: range.startChapterNumber,
            volumeNumber: range.volumeNumber,
          },
          {
            baseChapters: workingChapters,
            mergeChapters: true,
          },
        );

        if (!outlinePayload) {
          setBatchProgress({
            ...emptyBatchProgress,
            message: "章节目录生成失败。",
            status: "failed",
          });
          return;
        }

        workingChapters = outlinePayload.chapters;
      }

      const desiredChapterNumbers = getBatchDesiredChapterNumbers(
        workingChapters,
        currentChapterNumber,
      );
      const targetChapters = getBatchTargetChapters(workingChapters, currentChapterNumber);
      const readableChapterNumbers = new Set(
        workingChapters
          .filter((chapter) => desiredChapterNumbers.includes(chapter.chapterNumber))
          .filter((chapter) => hasReadableChapterBody(chapter))
          .map((chapter) => chapter.chapterNumber),
      );
      const skipped = readableChapterNumbers.size;

      if (targetChapters.length === 0) {
        setBatchProgress({
          ...emptyBatchProgress,
          message: "后20章暂无需要预生成的章节。",
          skipped,
          status: "success",
        });
        router.refresh();
        return;
      }

      const batchId = `reader-preload-${Date.now()}`;
      const routeRevision = `default-after-${currentChapterNumber ?? 0}`;
      const routeSnapshotHash = `${routeRevision}-${desiredChapterNumbers.join("-")}`;
      let completed = 0;

      for (const chapter of targetChapters) {
        setBatchProgress({
          completed,
          currentChapterNumber: chapter.chapterNumber,
          message: `正在生成第 ${chapter.chapterNumber} 章正文...`,
          skipped,
          status: "running",
          total: targetChapters.length,
        });

        const generatedChapter = await generateChapter(chapter, {
          batchMetadata: {
            batchRunId: batchId,
            generationSource: "batch-20",
            routeMode: "default",
            routeRevision,
            routeSnapshotHash,
          },
          qualityMode: "normal",
          refresh: false,
        });

        if (!generatedChapter) {
          setBatchProgress({
            completed,
            currentChapterNumber: chapter.chapterNumber,
            message: `第 ${chapter.chapterNumber} 章生成失败，已暂停。`,
            skipped,
            status: "failed",
            total: targetChapters.length,
          });
          return;
        }

        completed += 1;
        setBatchProgress({
          completed,
          currentChapterNumber: chapter.chapterNumber,
          message: `已完成第 ${chapter.chapterNumber} 章。`,
          skipped,
          status: "running",
          total: targetChapters.length,
        });
      }

      setBatchProgress({
        completed,
        currentChapterNumber: null,
        message: `已预生成 ${completed} 章正文。`,
        skipped,
        status: "success",
        total: targetChapters.length,
      });
      router.refresh();
    } finally {
      setIsBatchGenerating(false);
      setSetupStep("");
    }
  }

  function updateQualityMode(chapter: ChapterDisplay, mode: ChapterQualityMode) {
    setQualityModes((currentModes) => ({
      ...currentModes,
      [chapterKey(chapter)]: mode,
    }));
  }

  async function setOfficialChapter(chapter: ChapterDisplay) {
    const versionId = chapter.draft?.versionId;

    if (!chapter.id || !versionId) {
      setError("当前章节还没有可确认的正文版本。");
      return;
    }

    setError("");
    setSettingOfficialChapterNumber(chapter.chapterNumber);

    const response = await fetch("/api/chapters/set-official", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId: chapter.id,
        versionId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as SetOfficialResponse | null;

    setSettingOfficialChapterNumber(null);

    if (!response.ok || !payload?.official) {
      setError(formatUserFacingError(payload?.error, "正式稿设置失败，请稍后重试。"));
      return;
    }

    setChapters((currentChapters) =>
      currentChapters.map((currentChapter) =>
        currentChapter.id === chapter.id
          ? {
              ...currentChapter,
              official: payload.official,
            }
          : currentChapter,
      ),
    );
    router.refresh();
  }

  function updateIntervention(
    chapter: ChapterDisplay,
    key: keyof ChapterIntervention,
    value: string,
  ) {
    setInterventions((currentInterventions) => {
      const currentIntervention =
        currentInterventions[chapterKey(chapter)] ?? { ...EMPTY_CHAPTER_INTERVENTION };

      return {
        ...currentInterventions,
        [chapterKey(chapter)]: {
          ...currentIntervention,
          [key]: value,
        },
      };
    });
  }

  if (isReaderSidebar) {
    const batchDesiredChapterNumbers = getBatchDesiredChapterNumbers(
      chapters,
      currentChapterNumber,
    );
    const batchTargetChapters = getBatchTargetChapters(chapters, currentChapterNumber);
    const batchMissingOutlineRanges = getMissingBatchOutlineRanges(
      chapters,
      currentChapterNumber,
    );
    const batchEstimatedChapterCount = getEstimatedBatchChapterCount(
      chapters,
      currentChapterNumber,
    );
    const batchNeedsOutline = batchMissingOutlineRanges.length > 0;
    const batchMinimumCost =
      outlineCost * batchMissingOutlineRanges.length + chapterCost * batchEstimatedChapterCount;
    const batchHasWork = batchNeedsOutline || batchTargetChapters.length > 0;
    const hasEnoughBatchStartCredits =
      creditBalance === null || creditBalance >= batchMinimumCost;
    const batchCreditShortfallMessage =
      creditBalance === null || hasEnoughBatchStartCredits
        ? ""
        : formatModeCreditShortfall(creditBalance, batchMinimumCost, isInteractive);
    const batchProgressPercent =
      batchProgress.total > 0
        ? Math.min(100, Math.round((batchProgress.completed / batchProgress.total) * 100))
        : batchProgress.status === "success"
          ? 100
          : 0;
    const batchRangeLabel =
      batchDesiredChapterNumbers.length > 0
        ? `后20章范围：第 ${batchDesiredChapterNumbers[0]} - ${
            batchDesiredChapterNumbers[batchDesiredChapterNumbers.length - 1]
          } 章`
        : "当前后20章暂无章节目录。";
    const primaryActionCost = hasPrerequisites ? readerBootstrapCost : readerSetupCost;
    const primaryActionShortfallMessage = hasPrerequisites
      ? readerBootstrapCreditShortfallMessage
      : readerSetupCreditShortfallMessage;
    const hasEnoughPrimaryActionCredits = hasPrerequisites
      ? hasEnoughReaderBootstrapCredits
      : hasEnoughReaderSetupCredits;
    const primaryActionLabel = hasPrerequisites
      ? volume
        ? `重新铺开并进入第 1 章 · ${primaryActionCost} ${creditUnit}`
        : `铺开并进入第 1 章 · ${primaryActionCost} ${creditUnit}`
      : `一键准备并进入第 1 章 · ${primaryActionCost} ${creditUnit}`;
    const setupItems = [
      { done: effectiveSetupStatus.hasConcept, label: "作品设定" },
      {
        done: effectiveSetupStatus.hasBible && effectiveSetupStatus.hasCharacters,
        label: "故事资料",
      },
      { done: Boolean(volume), label: "章节目录" },
      {
        done: chapters.some(
          (chapter) =>
            chapter.chapterNumber === 1 && (chapter.official?.body || chapter.draft?.body),
        ),
        label: "第一章正文",
      },
    ];

    return (
      <section className="reader-sidebar-outline">
        <div className="reader-sidebar-outline-head">
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-black text-[var(--ink)]">章节目录</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--muted)]">
              {volume
                ? `第 ${volume.volumeNumber} 卷 · ${volume.title}`
                : hasPrerequisites
                  ? "铺开章节后，第 1 章会自动生成。"
                  : "一键准备资料、铺开章节并生成第 1 章。"}
            </p>
          </div>
          <button
            className="button-secondary reader-sidebar-outline-action disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGenerating || isBatchGenerating || !hasEnoughPrimaryActionCredits}
            onClick={hasPrerequisites ? () => generateOutline() : generateReaderSetup}
            type="button"
          >
            {isGenerating
              ? setupStep || (generatingChapterNumber === 1 ? "第 1 章生成中..." : "铺开中...")
              : primaryActionLabel}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-xs font-bold leading-5 text-[#7f2f1d]">
            {error}
          </p>
        ) : null}

        {primaryActionShortfallMessage ? (
          <p className="mt-3 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-xs font-bold leading-5 text-[#7f2f1d]">
            {primaryActionShortfallMessage}
            <Link className="ml-1 underline" href="/account/credits">
              {isInteractive ? "补充星火" : "补充额度"}
            </Link>
          </p>
        ) : null}

        {!hasPrerequisites ? (
          <div className="reader-setup-status mt-4">
            {setupItems.map((item) => (
              <span className={item.done ? "reader-setup-item-done" : ""} key={item.label}>
                {item.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="reader-batch-actions mt-4">
          <button
            className="button-secondary reader-sidebar-outline-action disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              isGenerating ||
              isBatchGenerating ||
              generatingChapterNumber !== null ||
              !hasPrerequisites ||
              !hasEnoughBatchStartCredits ||
              !batchHasWork
            }
            onClick={generateBatchChapters}
            type="button"
          >
            {isBatchGenerating ? batchProgress.message || "预生成中..." : "预生成后20章正文"}
          </button>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--muted)]">
            {batchRangeLabel} 已有正文会跳过；需要重生的章节会重新生成，模式固定为 normal。
          </p>
          {batchCreditShortfallMessage ? (
            <p className="mt-2 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-xs font-bold leading-5 text-[#7f2f1d]">
              {batchCreditShortfallMessage}
              <Link className="ml-1 underline" href="/account/credits">
                {isInteractive ? "补充星火" : "补充额度"}
              </Link>
            </p>
          ) : null}
          {batchProgress.status !== "idle" ? (
            <div className={`reader-batch-progress reader-batch-progress-${batchProgress.status}`}>
              <div className="reader-batch-progress-head">
                <span>{batchProgress.message}</span>
                <span>
                  {batchProgress.completed}/{batchProgress.total}
                </span>
              </div>
              <div className="reader-batch-progress-track" aria-hidden="true">
                <span style={{ width: `${batchProgressPercent}%` }} />
              </div>
              <p>
                {batchProgress.currentChapterNumber
                  ? `当前：第 ${batchProgress.currentChapterNumber} 章`
                  : "当前：等待下一步"}
                {batchProgress.skipped > 0 ? ` · 已跳过 ${batchProgress.skipped} 章` : ""}
              </p>
            </div>
          ) : null}
        </div>

        {chapters.length > 0 ? (
          <div className="reader-sidebar-chapters mt-4">
            {chapters.map((chapter) => {
              const isCurrent = chapter.chapterNumber === currentChapterNumber;
              const needsRegeneration = chapterNeedsRegeneration(chapter);
              const hasReadableBody = hasReadableChapterBody(chapter);

              return (
                <a
                  aria-current={isCurrent ? "page" : undefined}
                  className={[
                    "reader-sidebar-chapter",
                    isCurrent ? "reader-sidebar-chapter-active" : "",
                  ].join(" ")}
                  href={`/project/${projectId}?chapter=${chapter.chapterNumber}#chapter-reader`}
                  key={chapter.id ?? chapter.chapterNumber}
                >
                  <span className="reader-sidebar-chapter-link">
                    <span className="reader-sidebar-chapter-copy">
                      <span className="reader-sidebar-chapter-number">
                        第 {chapter.chapterNumber} 章
                      </span>
                      <span className="reader-sidebar-chapter-title">{chapter.title}</span>
                    </span>
                    <span className="reader-sidebar-chapter-status">
                      {needsRegeneration
                        ? "需重生"
                        : isCurrent
                          ? "当前"
                          : hasReadableBody
                            ? "可阅读"
                            : "待生成"}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3 text-sm font-bold leading-6 text-[var(--muted)]">
            {hasPrerequisites
              ? "还没有章节目录，先点击“铺开并进入第 1 章”。"
              : "还没有章节目录，点击上方按钮后会自动准备并进入正文。"}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--ink)]">
            {isInteractive ? "故事章节" : "章节大纲"}
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
            {isInteractive
              ? "先铺开第一卷章节。进入下一章前，会沿用上一章已做出的选择和当前故事状态。"
              : "基于已保存的设定、故事圣经和角色卡生成第一卷 20 章大纲。生成可能需要几十秒；重新生成会覆盖当前卷信息和章节大纲，并记录生成日志。"}
          </p>
        </div>
        <button
          className="button-primary"
          disabled={isGenerating || isBatchGenerating || !hasPrerequisites || !hasEnoughOutlineCredits}
          onClick={() => generateOutline()}
          type="button"
        >
          {isGenerating
            ? "生成中..."
            : volume
              ? `${isInteractive ? "重新铺开" : "重新生成"} · ${outlineCost} ${creditUnit}`
              : `${isInteractive ? "铺开章节" : "生成章节大纲"} · ${outlineCost} ${creditUnit}`}
        </button>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}

      {outlineCreditShortfallMessage || chapterCreditShortfallMessage ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {chapterCreditShortfallMessage || outlineCreditShortfallMessage}
          <Link className="ml-2 font-bold underline" href="/account/credits">
            {isInteractive ? "补充星火" : "查看点数"}
          </Link>
        </p>
      ) : null}

      {!hasPrerequisites ? (
        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-bold text-[var(--ink)]">需要先完成故事圣经和角色卡</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            章节大纲会基于已保存的 story_config、story_concept、story_bible 和 characters 生成。
          </p>
        </div>
      ) : volume ? (
        <div className="mt-6 grid gap-6">
          <article className="rounded-md border border-[var(--line)] bg-white px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  第一卷
                </p>
                <h3 className="mt-1 text-xl font-black text-[var(--ink)]">{volume.title}</h3>
              </div>
              <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
                {chapters.length} 章
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {volumeSections.map((section) => (
                <div key={section.key}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    {section.label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                    {volume[section.key]}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-3">
            {chapters.map((chapter) => {
              const selectedQualityMode = qualityModes[chapterKey(chapter)] ?? "normal";
              const selectedQualityOption =
                chapterQualityOptions.find((option) => option.mode === selectedQualityMode) ??
                chapterQualityOptions[0];
              const selectedChapterCost = getChapterGenerationCost(selectedQualityMode);
              const hasEnoughSelectedChapterCredits =
                creditBalance === null || creditBalance >= selectedChapterCost;
              const selectedChapterCreditShortfallMessage =
                creditBalance === null || hasEnoughSelectedChapterCredits
                  ? ""
                  : formatModeCreditShortfall(creditBalance, selectedChapterCost, isInteractive);
              const quality = chapter.draft?.quality;
              const qualityScoreItems = getQualityScoreItems(chapter);

              return (
              <article
                className="rounded-md border border-[var(--line)] bg-white px-4 py-4"
                key={chapter.chapterNumber}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      第 {chapter.chapterNumber} 章
                    </p>
                    <h4 className="mt-1 text-lg font-black text-[var(--ink)]">
                      {chapter.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f7efe6] px-3 py-1 text-xs font-bold text-[#80522f]">
                      预计 {chapter.estimatedWords} 字
                    </span>
                    <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
                      {chapter.versionCount ?? 0} 个版本
                    </span>
                    {chapter.official ? (
                      <span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-bold text-[#285f8f]">
                        正式稿已确认
                      </span>
                    ) : null}
                    <button
                      className="button-secondary min-h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        isBatchGenerating ||
                        generatingChapterNumber !== null ||
                        settingOfficialChapterNumber !== null ||
                        !hasEnoughSelectedChapterCredits
                      }
                      onClick={() => generateChapter(chapter)}
                      type="button"
                    >
                      {generatingChapterNumber === chapter.chapterNumber
                        ? selectedQualityMode === "quality"
                          ? "精修生成中..."
                          : isInteractive
                            ? "正在进入本章..."
                            : "正文生成中..."
                        : chapter.draft?.body
                          ? `重新${selectedQualityOption.buttonLabel} · ${selectedChapterCost} ${creditUnit}`
                          : `${selectedQualityOption.buttonLabel} · ${selectedChapterCost} ${creditUnit}`}
                    </button>
                    {chapter.draft?.body ? (
                      <button
                        className="button-primary min-h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          !chapter.draft.versionId ||
                          chapter.official?.versionId === chapter.draft.versionId ||
                          isBatchGenerating ||
                          generatingChapterNumber !== null ||
                          settingOfficialChapterNumber !== null
                        }
                        onClick={() => setOfficialChapter(chapter)}
                        type="button"
                      >
                        {settingOfficialChapterNumber === chapter.chapterNumber
                          ? "确认中..."
                          : chapter.official?.versionId === chapter.draft.versionId
                            ? isInteractive
                              ? "这条命运已确认"
                              : "当前为正式稿"
                            : isInteractive
                              ? "确认这条命运"
                              : "设为正式稿"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {isInteractive ? (
                  <p className="mt-3 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
                    进入这一章时，会读取上一章选择、当前故事状态和本章导演指令。
                  </p>
                ) : null}

                <div className="mt-4 rounded-md border border-[var(--line)] bg-[#fffaf0] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      生成模式
                    </p>
                    <div
                      aria-label="章节生成质量模式"
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                    >
                      {chapterQualityOptions.map((option) => {
                        const optionCost = getChapterGenerationCost(option.mode);
                        const isSelected = selectedQualityMode === option.mode;

                        return (
                          <button
                            aria-checked={isSelected}
                            className={[
                              "rounded-md border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                              isSelected
                                ? "border-[var(--accent)] bg-[#eef4f2] text-[var(--accent-strong)]"
                                : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]",
                            ].join(" ")}
                            disabled={isBatchGenerating || generatingChapterNumber !== null}
                            key={option.mode}
                            onClick={() => updateQualityMode(chapter, option.mode)}
                            role="radio"
                            type="button"
                          >
                            {option.label} · {optionCost} {creditUnit}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {selectedQualityOption.description}
                  </p>
                  {selectedChapterCreditShortfallMessage ? (
                    <p className="mt-2 text-sm font-bold text-[#7f2f1d]">
                      {selectedChapterCreditShortfallMessage}
                      <Link className="ml-2 underline" href="/account/credits">
                        {isInteractive ? "补充星火" : "查看点数"}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {chapterSections.map((section) => (
                    <div key={section.key}>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                        {section.label}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                        {chapter[section.key]}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    本章导演指令 / 互动干预
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {interventionFields.map((field) => (
                      <label className="grid gap-1" key={field.key}>
                        <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                          {field.label}
                        </span>
                        <textarea
                          className="min-h-20 resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                          disabled={isBatchGenerating || generatingChapterNumber !== null}
                          maxLength={CHAPTER_INTERVENTION_LIMITS[field.key]}
                          onChange={(event) =>
                            updateIntervention(chapter, field.key, event.target.value)
                          }
                          placeholder={field.placeholder}
                          rows={field.rows}
                          value={
                            interventions[chapterKey(chapter)]?.[field.key] ??
                            EMPTY_CHAPTER_INTERVENTION[field.key]
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {quality ? (
                  <details className="mt-5 border-t border-[var(--line)] pt-4">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-md bg-[#f8fbfa] px-3 py-3">
                      <span className="text-sm font-black text-[var(--ink)]">质量报告</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--muted)]">
                        <span>整体评分 {quality.critique?.overallScore ?? "--"}</span>
                        <span>{formatRewriteStatus(quality)}</span>
                        <span className="rounded-full bg-[#eef4f2] px-3 py-1 text-[var(--accent-strong)]">
                          {quality.mode ?? "quality-v1"}
                        </span>
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                      <div className="rounded-md border border-[var(--line)] bg-[#f8fbfa] px-3 py-3">
                        <p className="text-xs font-bold text-[var(--muted)]">整体评分</p>
                        <p className="mt-1 text-lg font-black text-[var(--ink)]">
                          {quality.critique?.overallScore ?? "--"}
                        </p>
                      </div>
                      <div className="rounded-md border border-[var(--line)] bg-[#f8fbfa] px-3 py-3">
                        <p className="text-xs font-bold text-[var(--muted)]">流水线状态</p>
                        <p className="mt-1 text-sm font-bold leading-6 text-[var(--ink)]">
                          {formatQualityPipelineStatus(quality)}
                        </p>
                      </div>
                      <div className="rounded-md border border-[var(--line)] bg-[#f8fbfa] px-3 py-3">
                        <p className="text-xs font-bold text-[var(--muted)]">修订状态</p>
                        <p className="mt-1 text-sm font-bold leading-6 text-[var(--ink)]">
                          {formatRewriteStatus(quality)}
                        </p>
                      </div>
                      {qualityScoreItems.map((item) => (
                        <div
                          className="rounded-md border border-[var(--line)] bg-[#f8fbfa] px-3 py-3"
                          key={item.key}
                        >
                          <p className="text-xs font-bold text-[var(--muted)]">{item.label}</p>
                          <p className="mt-1 text-lg font-black text-[var(--ink)]">
                            {item.value ?? "--"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {chapter.draft?.body ? (
                  <div className="mt-5 border-t border-[var(--line)] pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      当前 draft 正文
                    </p>
                    <div className="mt-3 whitespace-pre-wrap rounded-md bg-[#fffaf0] px-4 py-4 leading-8 text-[var(--ink)]">
                      {chapter.draft.body}
                    </div>
                  </div>
                ) : null}

                {chapter.official ? (
                  <div className="mt-5 border-t border-[var(--line)] pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      正式稿
                    </p>
                    <div className="mt-3 whitespace-pre-wrap rounded-md bg-[#eef4f2] px-4 py-4 leading-8 text-[var(--ink)]">
                      {chapter.official.body}
                    </div>
                  </div>
                ) : null}

                {chapter.summary ? (
                  <div className="mt-5 border-t border-[var(--line)] pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      章节摘要 / 连续性状态
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {summarySections.map((section) => (
                        <div
                          className="rounded-md border border-[var(--line)] bg-[#f8fbfa] px-3 py-3"
                          key={section.key}
                        >
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                            {section.label}
                          </p>
                          <p className="mt-1 line-clamp-3 leading-7 text-[var(--ink)]">
                            {formatSummaryValue(chapter.summary?.[section.key] ?? "")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-bold text-[var(--ink)]">还没有章节大纲</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            点击生成后，第一卷信息会写入 volumes，20 章大纲会写入 chapters。
          </p>
        </div>
      )}
    </section>
  );
}
