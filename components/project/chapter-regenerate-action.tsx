"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChapterQualityModeSelector,
  formatChapterQualityShortfall,
  getChapterQualityModeCost,
  type ChapterQualityMode,
} from "@/components/project/chapter-quality-mode-selector";
import { formatUserFacingError } from "@/lib/ui/errors";

type ChapterRegenerationResponse = {
  chapter?: {
    chapterNumber?: number;
  };
  error?: string;
};

type ChapterRegenerateActionProps = {
  chapterNumber: number;
  creditBalance: number | null;
  creditUnit: string;
  projectId: string;
};

export function ChapterRegenerateAction({
  chapterNumber,
  creditBalance,
  creditUnit,
  projectId,
}: ChapterRegenerateActionProps) {
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [qualityMode, setQualityMode] = useState<ChapterQualityMode>("normal");
  const router = useRouter();
  const chapterCost = getChapterQualityModeCost(qualityMode);
  const hasEnoughCredits = creditBalance === null || creditBalance >= chapterCost;
  const creditShortfallMessage = hasEnoughCredits
    ? ""
    : formatChapterQualityShortfall({
        balance: creditBalance,
        cost: chapterCost,
        unit: creditUnit,
      });

  async function regenerateChapter() {
    if (!hasEnoughCredits) {
      setError(creditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          chapterNumber,
          qualityMode,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ChapterRegenerationResponse | null;

      if (!response.ok || !payload?.chapter) {
        setError(formatUserFacingError(payload?.error, "本章重生失败，请稍后重试。"));
        return;
      }

      const generatedChapterNumber = payload.chapter.chapterNumber ?? chapterNumber;
      router.push(`/project/${projectId}?chapter=${generatedChapterNumber}#chapter-reader`);
      router.refresh();
    } catch {
      setError("网络异常，本章重生请求未完成，请检查网络后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="chapter-regenerate-panel">
      <ChapterQualityModeSelector
        creditUnit={creditUnit}
        disabled={isGenerating}
        mode={qualityMode}
        onChange={setQualityMode}
      />
      <button
        className="button-primary mt-3 min-h-10 w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isGenerating || !hasEnoughCredits}
        onClick={regenerateChapter}
        type="button"
      >
        {isGenerating ? "正在按新命运重生..." : `消耗 ${chapterCost} ${creditUnit}重生本章`}
      </button>
      {creditShortfallMessage ? (
        <p className="mt-3 text-sm font-bold leading-6 text-[#7f2f1d]">
          {creditShortfallMessage}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
