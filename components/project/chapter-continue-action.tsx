"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge } from "@/components/ui/book";
import { GENERATION_CREDIT_COSTS } from "@/lib/credits";
import { formatUserFacingError } from "@/lib/ui/errors";

type ChapterGenerationResponse = {
  chapter?: {
    chapterNumber?: number;
  };
  error?: string;
};

type ChapterContinueActionProps = {
  creditBalance: number | null;
  hasNextChapter: boolean;
  nextChapterNumber?: number | null;
  projectId: string;
};

export function ChapterContinueAction({
  creditBalance,
  hasNextChapter,
  nextChapterNumber,
  projectId,
}: ChapterContinueActionProps) {
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const chapterCost = GENERATION_CREDIT_COSTS.generate_chapter;
  const hasEnoughCredits = creditBalance === null || creditBalance >= chapterCost;
  const creditShortfallMessage = hasEnoughCredits
    ? ""
    : `额度不足：当前 ${creditBalance} 额度，进入下一章需要 ${chapterCost} 额度。`;

  async function generateNextChapter() {
    if (!hasNextChapter || !nextChapterNumber) {
      setError("需要先铺开后续章节。");
      return;
    }

    if (!hasEnoughCredits) {
      setError(creditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    const response = await fetch("/api/generate/chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterNumber: nextChapterNumber,
        qualityMode: "normal",
      }),
    });
    const payload = (await response.json().catch(() => null)) as ChapterGenerationResponse | null;

    setIsGenerating(false);

    if (!response.ok || !payload?.chapter) {
      setError(formatUserFacingError(payload?.error, "下一章生成失败，请稍后重试。"));
      return;
    }

    const generatedChapterNumber = payload.chapter.chapterNumber ?? nextChapterNumber;
    router.push(`/project/${projectId}?chapter=${generatedChapterNumber}#chapter-reader`);
    router.refresh();
  }

  return (
    <div className="chapter-continue-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <BookBadge tone="gold">继续阅读</BookBadge>
          <h3 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            进入下一章
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            正文读完后，消耗额度生成下一章并继续阅读。
          </p>
        </div>
        {hasNextChapter && nextChapterNumber ? (
          <button
            className="button-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGenerating || !hasEnoughCredits}
            onClick={generateNextChapter}
            type="button"
          >
            {isGenerating ? "下一章生成中..." : `消耗 ${chapterCost} 额度进入下一章`}
          </button>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2 text-sm font-bold leading-6 text-[var(--muted)]">
            需要先铺开后续章节。
          </p>
        )}
      </div>
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
