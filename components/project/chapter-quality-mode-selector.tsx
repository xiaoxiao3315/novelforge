"use client";

import { GENERATION_CREDIT_COSTS } from "@/lib/credits";

export type ChapterQualityMode = "normal" | "quality";

const chapterQualityModeOptions: Array<{
  mode: ChapterQualityMode;
  label: string;
  cost: number;
  description: string;
}> = [
  {
    mode: "normal",
    label: "普通生成",
    cost: GENERATION_CREDIT_COSTS.generate_chapter,
    description: "快速生成下一章，适合继续草稿阅读。",
  },
  {
    mode: "quality",
    label: "高质量生成",
    cost: GENERATION_CREDIT_COSTS.generate_chapter_quality,
    description: "先策划角色，再审稿评分并按需修订，耗时更久。",
  },
];

export function getChapterQualityModeCost(mode: ChapterQualityMode) {
  return mode === "quality"
    ? GENERATION_CREDIT_COSTS.generate_chapter_quality
    : GENERATION_CREDIT_COSTS.generate_chapter;
}

export function formatChapterQualityShortfall({
  balance,
  cost,
  unit,
}: {
  balance: number;
  cost: number;
  unit: string;
}) {
  const shortage = Math.max(cost - balance, 0);
  return `${unit}不足：当前 ${balance} ${unit}，本次生成需要 ${cost} ${unit}，还差 ${shortage} ${unit}。`;
}

export function ChapterQualityModeSelector({
  creditUnit,
  disabled = false,
  mode,
  onChange,
}: {
  creditUnit: string;
  disabled?: boolean;
  mode: ChapterQualityMode;
  onChange: (mode: ChapterQualityMode) => void;
}) {
  return (
    <div className="grid gap-2" aria-label="章节生成质量模式">
      <div className="flex flex-wrap gap-2">
        {chapterQualityModeOptions.map((option) => {
          const isSelected = mode === option.mode;

          return (
            <button
              className={`rounded-md border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-[var(--gold)] bg-[rgba(255,244,220,0.92)] text-[var(--ink)] shadow-sm"
                  : "border-[var(--line)] bg-[rgba(255,248,234,0.68)] text-[var(--muted)] hover:border-[var(--gold)]"
              }`}
              disabled={disabled}
              key={option.mode}
              onClick={() => onChange(option.mode)}
              type="button"
            >
              <span className="block font-black">
                {option.label} · {option.cost} {creditUnit}
              </span>
              <span className="mt-1 block max-w-52 leading-5">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
