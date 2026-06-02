"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge, PaperPanel } from "@/components/ui/book";
import { formatUserFacingError } from "@/lib/ui/errors";
import {
  CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT,
  hasSelectedChapterDecision,
  type ChapterDecision,
  type ChapterDecisionOptionId,
} from "@/prompts/chapter-decision";

type DecisionResponse = {
  chapterId?: string;
  decision?: ChapterDecision;
  error?: string;
};

type ChapterEndDecisionProps = {
  chapterId: string;
  chapterNumber: number;
  initialDecision?: ChapterDecision | null;
  projectId: string;
};

export function ChapterEndDecision({
  chapterId,
  chapterNumber,
  initialDecision,
  projectId,
}: ChapterEndDecisionProps) {
  const [decision, setDecision] = useState(initialDecision ?? null);
  const [selectedOptionId, setSelectedOptionId] = useState<ChapterDecisionOptionId | "">(
    initialDecision?.selectedOptionId ?? "",
  );
  const [customChoice, setCustomChoice] = useState(initialDecision?.customChoice ?? "");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

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
      setError(formatUserFacingError(payload?.error, "本章抉择生成失败，请稍后重试。"));
      return;
    }

    setDecision(payload.decision);
    setSelectedOptionId(payload.decision.selectedOptionId ?? "");
    setCustomChoice(payload.decision.customChoice ?? "");
    router.refresh();
  }

  async function saveDecision() {
    if (!decision) {
      setError("请先生成本章抉择。");
      return;
    }

    if (!selectedOptionId && !customChoice.trim()) {
      setError("请选择一个选项，或填写自定义选择。");
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
      setError(formatUserFacingError(payload?.error, "本章抉择保存失败，请稍后重试。"));
      return;
    }

    setDecision(payload.decision);
    setSelectedOptionId(payload.decision.selectedOptionId ?? "");
    setCustomChoice(payload.decision.customChoice ?? "");
    router.refresh();
  }

  return (
    <PaperPanel className="mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookBadge tone="warning">章末抉择</BookBadge>
          <h3 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            本章抉择
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            读完本章后再做选择。保存后的抉择会作为下一章生成的优先上下文。
          </p>
        </div>
        <button
          className="button-secondary min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || isSaving}
          onClick={generateDecision}
          type="button"
        >
          {isGenerating
            ? "本章抉择生成中..."
            : decision
              ? "重新生成本章抉择"
              : "生成本章抉择"}
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

          <div className="grid gap-3 lg:grid-cols-3">
            {decision.options.map((option) => (
              <label
                className={`rounded-md border px-3 py-3 ${
                  selectedOptionId === option.id
                    ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]"
                    : "border-[var(--line)] bg-[rgba(255,248,234,0.68)]"
                }`}
                key={option.id}
              >
                <span className="flex items-start gap-2">
                  <input
                    checked={selectedOptionId === option.id}
                    className="mt-1"
                    disabled={isSaving}
                    name={`chapter-end-decision-${chapterId}`}
                    onChange={() => setSelectedOptionId(option.id)}
                    type="radio"
                    value={option.id}
                  />
                  <span>
                    <span className="block font-black text-[var(--ink)]">
                      {option.id}. {option.label}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                      {option.description}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                      {option.expectedEffects.join("；")}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">
              自定义选择
            </span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.82)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--gold)]"
              disabled={isSaving}
              maxLength={CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
              onChange={(event) => setCustomChoice(event.target.value)}
              placeholder="也可以写一个自己的章末选择，保存后会影响下一章。"
              rows={3}
              value={customChoice}
            />
            <span className="text-right text-xs font-bold text-[var(--muted)]">
              {customChoice.length}/{CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {hasSelectedChapterDecision(decision)
                ? "已保存本章抉择。下一章生成时会优先读取它。"
                : "尚未保存抉择。"}
            </p>
            <button
              className="button-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={saveDecision}
              type="button"
            >
              {isSaving ? "保存中..." : "保存选择"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-7 text-[var(--muted)]">
          还没有本章抉择。读完正文后点击“生成本章抉择”，会出现 A/B/C 三个选项，也可以填写自定义选择。
        </div>
      )}
    </PaperPanel>
  );
}
