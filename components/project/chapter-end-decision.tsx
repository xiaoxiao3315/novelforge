"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChapterQualityModeSelector,
  formatChapterQualityShortfall,
  getChapterQualityModeCost,
  type ChapterQualityMode,
} from "@/components/project/chapter-quality-mode-selector";
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
  chapter?: {
    chapterNumber?: number;
  };
  error?: string;
};

type ChapterEndDecisionProps = {
  chapterId: string;
  chapterNumber: number;
  creditBalance: number | null;
  hasNextChapter: boolean;
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

export function ChapterEndDecision({
  chapterId,
  chapterNumber,
  creditBalance,
  hasNextChapter,
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingNextChapter, setIsGeneratingNextChapter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nextChapterQualityMode, setNextChapterQualityMode] =
    useState<ChapterQualityMode>("normal");
  const router = useRouter();
  const nextChapterCost = getChapterQualityModeCost(nextChapterQualityMode);
  const hasSavedDecision = decision ? hasSelectedChapterDecision(decision) : false;
  const hasPendingChoice = decision
    ? (selectedOptionId || "") !== (decision.selectedOptionId ?? "") ||
      customChoice.trim() !== (decision.customChoice ?? "").trim()
    : false;
  const decisionStatus = hasPendingChoice
    ? {
        body: "点击“做出选择”后，故事才会把这条路写入下一章。",
        className: "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]",
        title: "有新的选择待确认",
      }
    : hasSavedDecision
      ? {
          body: "下一章会沿用上一章选择和当前故事状态继续推进。",
          className: "border-[#b8d8c7] bg-[#f0fbf5]",
          title: "这条命运已确认",
        }
      : {
          body: "读完正文后选择一个方向，也可以写下自定义命运。",
          className: "border-[var(--line)] bg-[rgba(255,248,234,0.68)]",
          title: "选择尚未落定",
        };
  const selectedChoiceLabel = decision ? getSelectedChoiceLabel(decision) : "";
  const hasEnoughNextChapterCredits =
    creditBalance === null || creditBalance >= nextChapterCost;
  const nextChapterCreditShortfallMessage = hasEnoughNextChapterCredits
    ? ""
    : formatChapterQualityShortfall({
        balance: creditBalance,
        cost: nextChapterCost,
        unit: "星火",
      });

  async function generateDecision() {
    setError("");
    setIsGenerating(true);

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

    setIsGenerating(false);

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
  }

  async function saveDecision() {
    if (!decision) {
      setError("请先开启命运分歧。");
      return;
    }

    if (!selectedOptionId && !customChoice.trim()) {
      setError("请先选定一个方向，或写下自定义命运。");
      return;
    }

    setError("");
    setIsSaving(true);

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

    setIsSaving(false);

    if (!response.ok || !payload?.decision) {
      setError(formatUserFacingError(payload?.error, "这条命运确认失败，请稍后重试。"));
      return;
    }

    setDecision(payload.decision);
    setInteractiveState(payload.interactiveState ?? interactiveState);
    setStateChanges(payload.stateChanges ?? stateChanges);
    setSelectedOptionId(payload.decision.selectedOptionId ?? "");
    setCustomChoice(payload.decision.customChoice ?? "");
    router.refresh();
  }

  async function generateNextChapter() {
    if (!hasNextChapter || !nextChapterNumber) {
      setError("需要先铺开后续章节。");
      return;
    }

    if (!hasEnoughNextChapterCredits) {
      setError(nextChapterCreditShortfallMessage);
      return;
    }

    if (hasPendingChoice) {
      setError("请先确认新的命运选择。");
      return;
    }

    setError("");
    setIsGeneratingNextChapter(true);

    const response = await fetch("/api/generate/chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterNumber: nextChapterNumber,
        qualityMode: nextChapterQualityMode,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ChapterGenerationResponse | null;

    setIsGeneratingNextChapter(false);

    if (!response.ok || !payload?.chapter) {
      setError(formatUserFacingError(payload?.error, "下一章生成失败，请稍后重试。"));
      return;
    }

    const generatedChapterNumber = payload.chapter.chapterNumber ?? nextChapterNumber;
    router.push(`/project/${projectId}?chapter=${generatedChapterNumber}#chapter-reader`);
    router.refresh();
  }

  return (
    <PaperPanel className="chapter-decision-panel mt-0 p-0">
      <div className="decision-panel-header">
        <div>
          <BookBadge tone="warning">命运分歧</BookBadge>
          <h3 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            读完之后，选一条路
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            做出选择后，下一章会沿用这次选择和当前故事状态继续推进。
          </p>
        </div>
        <button
          className="button-secondary decision-quiet-button min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || isSaving || isGeneratingNextChapter}
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

      {error ? (
        <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
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
                  <span className="block text-xs leading-5 text-[var(--muted)]">
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
              disabled={isSaving || isGeneratingNextChapter}
              onClick={saveDecision}
              type="button"
            >
              {isSaving ? "正在写入..." : "做出选择"}
            </button>
          </div>
          {hasSavedDecision ? (
            <div className="choice-result-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <BookBadge tone="success">命运已写入故事</BookBadge>
                  <h4 className="mt-3 font-serif text-xl font-black text-[var(--ink)]">
                    你选择了
                  </h4>
                  <p className="mt-2 text-sm font-bold leading-7 text-[var(--ink-soft)]">
                    {selectedChoiceLabel}
                  </p>
                </div>
                {hasNextChapter && nextChapterNumber ? (
                  <div className="grid gap-3">
                    <ChapterQualityModeSelector
                      creditUnit="星火"
                      disabled={isGeneratingNextChapter || isSaving}
                      mode={nextChapterQualityMode}
                      onChange={setNextChapterQualityMode}
                    />
                    <button
                      className="button-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        isGeneratingNextChapter ||
                        isSaving ||
                        hasPendingChoice ||
                        !hasEnoughNextChapterCredits
                      }
                      onClick={generateNextChapter}
                      type="button"
                    >
                      {isGeneratingNextChapter
                        ? nextChapterQualityMode === "quality"
                          ? "精修生成中..."
                          : "下一章生成中..."
                        : hasPendingChoice
                          ? "先确认新的选择"
                          : `消耗 ${nextChapterCost} 星火进入下一章`}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2 text-sm font-bold leading-6 text-[var(--muted)]">
                    需要先铺开后续章节。
                  </p>
                )}
              </div>
              {nextChapterCreditShortfallMessage ? (
                <p className="mt-3 text-sm font-bold leading-6 text-[#7f2f1d]">
                  {nextChapterCreditShortfallMessage}
                </p>
              ) : null}
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                下一章将沿着这条命运继续，当前正文不会被改写。
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-7 text-[var(--muted)]">
          {decisionGeneration?.status === "failed"
            ? "命运分歧自动生成失败。可以点击上方按钮重试，本章正文不会被改写。"
            : "还没有命运分歧。读完正文后点击“开启命运分歧”，会出现 A/B/C 三个方向，也可以写下自定义命运。"}
        </div>
      )}
    </PaperPanel>
  );
}
