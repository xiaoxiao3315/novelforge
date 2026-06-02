"use client";

import { useMemo, useState } from "react";
import { BookBadge, PaperPanel } from "@/components/ui/book";
import type { ChapterDecision, DecisionOption, StoryImpact } from "@/lib/interactive/types";

type ChapterEndDecisionCardProps = {
  decision: ChapterDecision;
  initialSelectedOptionId: DecisionOption["id"];
};

const impactLabels: Record<StoryImpact["kind"], string> = {
  clue: "线索",
  flag: "标记",
  meter: "计量",
  relationship: "关系",
  route: "路线",
};

function formatDelta(delta?: number) {
  if (typeof delta !== "number") {
    return "已记录";
  }

  return delta > 0 ? `+${delta}` : String(delta);
}

function getOptionTone(optionId: DecisionOption["id"]) {
  if (optionId === "A") {
    return "warning";
  }

  if (optionId === "B") {
    return "success";
  }

  return "gold";
}

export function ChapterEndDecisionCard({
  decision,
  initialSelectedOptionId,
}: ChapterEndDecisionCardProps) {
  const [selectedOptionId, setSelectedOptionId] =
    useState<DecisionOption["id"]>(initialSelectedOptionId);
  const selectedOption = useMemo(
    () => decision.options.find((option) => option.id === selectedOptionId) ?? decision.options[0],
    [decision.options, selectedOptionId],
  );

  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookBadge tone="warning">章末选择</BookBadge>
          <h2 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            {decision.question}
          </h2>
        </div>
        <BookBadge tone={getOptionTone(selectedOption.id)}>已预览 {selectedOption.id}</BookBadge>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {decision.options.map((option) => {
          const isSelected = option.id === selectedOptionId;

          return (
            <button
              aria-pressed={isSelected}
              className={[
                "min-h-[220px] rounded-md border px-4 py-4 text-left transition",
                isSelected
                  ? "border-[var(--gold)] bg-[rgba(255,244,220,0.94)] shadow-[0_12px_28px_rgba(45,27,18,0.12)]"
                  : "border-[var(--line)] bg-[rgba(255,248,234,0.62)] hover:border-[var(--gold)]",
              ].join(" ")}
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-[var(--gold-strong)]">
                  Option {option.id}
                </span>
                <BookBadge tone={isSelected ? getOptionTone(option.id) : "paper"}>
                  {isSelected ? "选中" : "预览"}
                </BookBadge>
              </span>
              <span className="mt-4 block font-serif text-xl font-black leading-7 text-[var(--ink)]">
                {option.label}
              </span>
              <span className="mt-3 block text-sm leading-7 text-[var(--muted)]">
                {option.description}
              </span>
              <span className="mt-4 block rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-3 py-2 text-xs font-bold leading-5 text-[var(--ink-soft)]">
                {option.routeHint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl font-black text-[var(--ink)]">选择影响</h3>
          <BookBadge tone={getOptionTone(selectedOption.id)}>{selectedOption.label}</BookBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {selectedOption.effects.map((effect) => (
            <div
              className="rounded-md border border-[var(--line)] bg-[rgba(255,255,255,0.35)] px-3 py-3"
              key={`${effect.kind}-${effect.target}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-[var(--gold-strong)]">
                  {impactLabels[effect.kind]}
                </p>
                <span className="text-xs font-black text-[var(--ink)]">
                  {formatDelta(effect.delta)}
                </span>
              </div>
              <p className="mt-2 font-bold leading-6 text-[var(--ink)]">{effect.target}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{effect.note}</p>
            </div>
          ))}
        </div>
      </div>
    </PaperPanel>
  );
}
