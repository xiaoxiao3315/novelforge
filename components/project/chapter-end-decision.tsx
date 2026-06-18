"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge, PaperPanel } from "@/components/ui/book";
import { formatUserFacingError } from "@/lib/ui/errors";
import {
  CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT,
  hasSelectedChapterDecision,
  type ChapterDecision,
  type ChapterDecisionGeneration,
  type ChapterDecisionOptionId,
} from "@/prompts/chapter-decision";
import {
  type InteractiveStoryState,
  type StoryStateChanges,
} from "@/prompts/story-state";

type DecisionResponse = {
  chapterId?: string;
  decision?: ChapterDecision;
  decisionGeneration?: ChapterDecisionGeneration;
  interactiveState?: InteractiveStoryState;
  stateChanges?: StoryStateChanges;
  error?: string;
};

type ChapterGenerationResponse = {
  chapterId?: string;
  chapter?: unknown;
  error?: string;
};

type ChapterEndDecisionProps = {
  chapterId: string;
  chapterNumber: number;
  initialDecision?: ChapterDecision | null;
  initialDecisionGeneration?: ChapterDecisionGeneration | null;
  initialInteractiveState?: InteractiveStoryState | null;
  initialStateChanges?: StoryStateChanges | null;
  nextChapterNumber?: number | null;
  projectId: string;
};

function getSelectedChoiceLabel(decision: ChapterDecision) {
  const selectedOption = decision.selectedOptionId
    ? decision.options.find((option) => option.id === decision.selectedOptionId)
    : null;
  const customChoice = decision.customChoice.trim();

  if (customChoice) {
    return customChoice;
  }

  if (selectedOption) {
    return `${selectedOption.id}. ${selectedOption.label}`;
  }

  return "这条命运";
}

function dispatchPreloadPause(paused: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("novelforge:reader-preload-pause", {
      detail: { paused, reason: "decision" },
    }),
  );
}

export function ChapterEndDecision({
  chapterId,
  chapterNumber,
  initialDecision,
  initialDecisionGeneration,
  initialInteractiveState,
  initialStateChanges,
  nextChapterNumber,
  projectId,
}: ChapterEndDecisionProps) {
  const [decision, setDecision] = useState(initialDecision ?? null);
  const [decisionGeneration, setDecisionGeneration] = useState(
    initialDecisionGeneration ?? null,
  );
  const [interactiveState, setInteractiveState] = useState(initialInteractiveState ?? null);
  const [stateChanges, setStateChanges] = useState(initialStateChanges ?? null);
  const [selectedOptionId, setSelectedOptionId] = useState<ChapterDecisionOptionId | "">(
    initialDecision?.selectedOptionId ?? "",
  );
  const [customChoice, setCustomChoice] = useState(initialDecision?.customChoice ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingNextChapter, setIsGeneratingNextChapter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const openPanelRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const isBusy = isGenerating || isSaving || isGeneratingNextChapter;
  const hasSavedDecision = decision ? hasSelectedChapterDecision(decision) : false;
  const hasPendingChoice = decision
    ? (selectedOptionId || "") !== (decision.selectedOptionId ?? "") ||
      customChoice.trim() !== (decision.customChoice ?? "").trim()
    : false;
  const decisionStatus = hasPendingChoice
    ? {
        body: "点击“做出选择”后，故事才会把这条路写入后续章节。",
        className: "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]",
        title: "有新的选择待确认",
      }
    : hasSavedDecision
      ? {
          body: "后续章节会沿用这次选择和当前故事状态继续推进。",
          className: "border-[#b8d8c7] bg-[#f0fbf5]",
          title: "这条命运已确认",
        }
      : {
          body: "读完正文后选择一个方向，也可以写下自定义命运。",
          className: "border-[var(--line)] bg-[rgba(255,248,234,0.68)]",
          title: "选择尚未落定",
        };
  const selectedChoiceLabel = decision ? getSelectedChoiceLabel(decision) : "";
  const dockButtonTitle = hasSavedDecision
    ? "查看命运"
    : decision
      ? "继续选择"
      : "生成选择";
  const dockStatusLabel = hasSavedDecision ? "已选择" : decision ? "已生成" : "待生成";
  const decisionPrimaryLabel = isSaving
    ? "正在写入选择..."
    : isGeneratingNextChapter
      ? "正在生成下一章..."
      : hasSavedDecision && !hasPendingChoice
        ? nextChapterNumber
          ? "生成并进入下一章"
          : "下一章尚未铺开"
        : nextChapterNumber
          ? "做出选择并进入下一章"
          : "做出选择";

  useEffect(() => {
    dispatchPreloadPause(isOpen || isSaving || isGeneratingNextChapter);

    return () => dispatchPreloadPause(false);
  }, [isOpen, isSaving, isGeneratingNextChapter]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      openPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [isOpen]);

  async function generateDecision() {
    setIsOpen(true);
    setError("");
    setNotice("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate/chapter-decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          chapterId,
          chapterNumber,
        }),
      });
      const payload = (await response.json().catch(() => null)) as DecisionResponse | null;

      if (!response.ok || !payload?.decision) {
        setError(formatUserFacingError(payload?.error, "命运分歧生成失败，请稍后重试。"));
        return;
      }

      setDecision(payload.decision);
      setDecisionGeneration(payload.decisionGeneration ?? null);
      setStateChanges(payload.stateChanges ?? null);
      setSelectedOptionId(payload.decision.selectedOptionId ?? "");
      setCustomChoice(payload.decision.customChoice ?? "");
      router.refresh();
    } catch {
      setError("网络异常，命运分歧生成请求未完成，请检查网络后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function openDecisionDock() {
    setIsOpen(true);

    if (!decision && !isGenerating) {
      await generateDecision();
    }
  }

  async function generateNextChapterAndNavigate() {
    if (!nextChapterNumber) {
      setNotice("下一章尚未铺开。请先到目录生成后续章节大纲。");
      return;
    }

    setError("");
    setNotice("");
    setIsGeneratingNextChapter(true);

    try {
      const response = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          chapterNumber: nextChapterNumber,
          generationSource: "reader-preload-10",
          anchorChapterNumber: chapterNumber,
          qualityMode: "normal",
        }),
      });
      const payload = (await response.json().catch(() => null)) as ChapterGenerationResponse | null;

      if (!response.ok || !payload?.chapter) {
        setError(formatUserFacingError(payload?.error, "下一章生成失败，请稍后重试。"));
        return;
      }

      router.push(`/project/${projectId}?chapter=${nextChapterNumber}#chapter-reader`);
    } catch {
      setError("网络异常，下一章生成请求未完成，请检查网络后重试。");
    } finally {
      setIsGeneratingNextChapter(false);
    }
  }

  async function saveDecision() {
    if (!decision) {
      setError("请先开启命运分歧。");
      return;
    }

    if (hasSavedDecision && !hasPendingChoice) {
      await generateNextChapterAndNavigate();
      return;
    }

    if (!selectedOptionId && !customChoice.trim()) {
      setError("请先选定一个方向，或写下自定义命运。");
      return;
    }

    setError("");
    setNotice("");
    setIsSaving(true);

    let savedDecision: DecisionResponse["decision"] | null = null;

    try {
      const response = await fetch("/api/chapters/select-decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          chapterId,
          optionId: selectedOptionId || null,
          customChoice,
        }),
      });
      const payload = (await response.json().catch(() => null)) as DecisionResponse | null;

      if (!response.ok || !payload?.decision) {
        setError(formatUserFacingError(payload?.error, "这条命运确认失败，请稍后重试。"));
        return;
      }

      savedDecision = payload.decision;
      setDecision(payload.decision);
      setInteractiveState(payload.interactiveState ?? interactiveState);
      setStateChanges(payload.stateChanges ?? stateChanges);
      setSelectedOptionId(payload.decision.selectedOptionId ?? "");
      setCustomChoice(payload.decision.customChoice ?? "");
    } catch {
      setError("网络异常，命运确认请求未完成，请检查网络后重试。");
      return;
    } finally {
      setIsSaving(false);
    }

    if (savedDecision) {
      await generateNextChapterAndNavigate();
    }
  }

  if (!isOpen) {
    return (
      <div className="chapter-decision-inline chapter-decision-inline-collapsed">
        <button
          className="chapter-decision-inline-trigger disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isBusy}
          onClick={openDecisionDock}
          type="button"
        >
          <span>
            <strong>命运分歧</strong>
            <small>{dockStatusLabel}</small>
          </span>
          <b>{isGenerating ? "生成中..." : dockButtonTitle}</b>
        </button>
      </div>
    );
  }

  return (
    <div className="chapter-decision-inline chapter-decision-inline-open" ref={openPanelRef}>
      <PaperPanel className="chapter-decision-panel chapter-decision-inline-panel mt-0 p-0">
        <div className="decision-panel-header">
          <div>
            <BookBadge tone="warning">命运分歧</BookBadge>
            <h3 className="decision-panel-title mt-3 font-serif text-2xl font-black text-[var(--ink)]">
              读完之后，选一条路
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              做出选择后，系统会先生成下一章，再带你直接进入阅读。
            </p>
          </div>
          <div className="decision-panel-actions">
            <button
              aria-label="收起命运分歧"
              className="chapter-decision-close"
              disabled={isBusy}
              onClick={() => setIsOpen(false)}
              type="button"
            >
              x
            </button>
            <button
              className="button-secondary decision-quiet-button min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              onClick={generateDecision}
              type="button"
            >
              {isGenerating
                ? "命运分歧生成中..."
                : decision
                  ? "重新生成命运分歧"
                  : "开启命运分歧"}
            </button>
          </div>
        </div>

        <div className="chapter-decision-flow" aria-label="命运续读流程">
          <span className={decision ? "chapter-decision-flow-done" : ""}>生成分歧</span>
          <span className={hasSavedDecision || hasPendingChoice ? "chapter-decision-flow-done" : ""}>
            选择命运
          </span>
          <span className={isGeneratingNextChapter ? "chapter-decision-flow-active" : ""}>
            生成下一章
          </span>
          <span>进入阅读</span>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-3 py-2 text-sm font-bold leading-6 text-[var(--muted)]">
            {notice}
            <a className="ml-1 underline" href="#chapter-directory">
              打开目录
            </a>
          </p>
        ) : null}

        {decision ? (
          <div className="mt-5 grid gap-4">
            <p className="font-bold leading-7 text-[var(--ink)]">{decision.question}</p>

            <div className="chapter-choice-list">
              {decision.options.map((option) => (
                <label
                  className={`decision-option-card cursor-pointer rounded-md border px-3 py-3 transition ${
                    selectedOptionId === option.id
                      ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)] shadow-sm"
                      : "border-[var(--line)] bg-[rgba(255,248,234,0.68)]"
                  }`}
                  key={option.id}
                >
                  <span className="grid gap-2">
                    <input
                      checked={selectedOptionId === option.id}
                      className="sr-only"
                      disabled={isSaving || isGeneratingNextChapter}
                      name={`chapter-end-decision-${chapterId}`}
                      onChange={() => setSelectedOptionId(option.id)}
                      type="radio"
                      value={option.id}
                    />
                    <span className="flex items-start justify-between gap-3">
                      <span className="block font-black text-[var(--ink)]">
                        {option.id}. {option.label}
                      </span>
                      {selectedOptionId === option.id ? (
                        <BookBadge tone="warning">已选</BookBadge>
                      ) : null}
                    </span>
                    <span className="block text-sm leading-6 text-[var(--muted)]">
                      {option.description}
                    </span>
                    <span className="decision-option-effects block text-xs leading-5 text-[var(--muted)]">
                      回声：{option.expectedEffects.join("；")}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <details className="custom-choice-details">
              <summary>写自定义命运</summary>
              <label className="mt-3 grid gap-1">
                <span className="text-xs font-bold uppercase text-[var(--muted)]">
                  自定义命运
                </span>
                <textarea
                  className="min-h-24 resize-y rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.82)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--gold)]"
                  disabled={isSaving || isGeneratingNextChapter}
                  maxLength={CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
                  onChange={(event) => setCustomChoice(event.target.value)}
                  placeholder="如果三个选项都不够贴合，可以写下你希望主角做出的决定。"
                  rows={3}
                  value={customChoice}
                />
                <span className="text-right text-xs font-bold text-[var(--muted)]">
                  {customChoice.length}/{CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
                </span>
              </label>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className={`rounded-md border px-3 py-3 text-sm leading-6 ${decisionStatus.className}`}
              >
                <p className="font-black text-[var(--ink)]">{decisionStatus.title}</p>
                <p className="mt-1 text-[var(--muted)]">{decisionStatus.body}</p>
              </div>
              <button
                className="button-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isSaving ||
                  isGeneratingNextChapter ||
                  (hasSavedDecision && !hasPendingChoice && !nextChapterNumber)
                }
                onClick={saveDecision}
                type="button"
              >
                {decisionPrimaryLabel}
              </button>
            </div>

            {hasSavedDecision ? (
              <div className="choice-result-card">
                <BookBadge tone="success">命运已写入故事</BookBadge>
                <h4 className="mt-3 font-serif text-xl font-black text-[var(--ink)]">
                  你选择了
                </h4>
                <p className="mt-2 text-sm font-bold leading-7 text-[var(--ink-soft)]">
                  {selectedChoiceLabel}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  后续章节会沿着这条命运继续，当前正文不会被改写。
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-7 text-[var(--muted)]">
            {decisionGeneration?.status === "failed"
              ? "命运分歧自动生成失败。可以点击上方按钮重试，当前正文不会被改写。"
              : "还没有命运分歧。读完正文后点击“开启命运分歧”，会出现 A/B/C 三个方向，也可以写下自定义命运。"}
          </div>
        )}
      </PaperPanel>
    </div>
  );
}
