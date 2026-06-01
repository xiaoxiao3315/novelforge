"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENERATION_CREDIT_COSTS, formatCreditShortfall } from "@/lib/credits";
import type { StoryConcept } from "@/prompts/concept";

type ConceptGeneratorProps = {
  projectId: string;
  initialConcept: StoryConcept | null;
  creditBalance: number | null;
};

type ConceptResponse = {
  concept?: StoryConcept;
  error?: string;
};

const conceptSections: Array<{
  key: keyof Omit<StoryConcept, "readerHookQuestions">;
  label: string;
}> = [
  { key: "workTitle", label: "作品名" },
  { key: "logline", label: "一句话卖点" },
  { key: "premise", label: "故事前提" },
  { key: "protagonist", label: "主角设定" },
  { key: "protagonistGoal", label: "主角目标" },
  { key: "protagonistWeakness", label: "主角弱点" },
  { key: "antagonistOrObstacle", label: "主要反派或阻力" },
  { key: "worldRules", label: "世界规则" },
  { key: "surfaceConflict", label: "表层冲突" },
  { key: "middleConflict", label: "中层冲突" },
  { key: "deepConflict", label: "深层冲突" },
  { key: "firstVolumeHook", label: "第一卷钩子" },
];

export function ConceptGenerator({
  projectId,
  initialConcept,
  creditBalance,
}: ConceptGeneratorProps) {
  const [concept, setConcept] = useState(initialConcept);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const generationCost = GENERATION_CREDIT_COSTS.generate_concept;
  const hasEnoughCredits = creditBalance === null || creditBalance >= generationCost;
  const creditShortfallMessage =
    creditBalance === null || hasEnoughCredits
      ? ""
      : formatCreditShortfall(creditBalance, generationCost);

  async function generateConcept() {
    if (!hasEnoughCredits) {
      setError(creditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    const response = await fetch("/api/generate/concept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    });

    const payload = (await response.json().catch(() => null)) as ConceptResponse | null;

    setIsGenerating(false);

    if (!response.ok || !payload?.concept) {
      setError(payload?.error || "作品设定生成失败，请稍后重试。");
      return;
    }

    setConcept(payload.concept);
    router.refresh();
  }

  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--ink)]">作品设定</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
            基于已保存的剧情筛选器和补充想法生成 concept。重新生成会覆盖当前作品设定，并保留生成日志。
          </p>
        </div>
        <button
          className="button-primary"
          disabled={isGenerating || !hasEnoughCredits}
          onClick={generateConcept}
          type="button"
        >
          {isGenerating
            ? "生成中..."
            : concept
              ? `重新生成 · ${generationCost} 点`
              : `生成作品设定 · ${generationCost} 点`}
        </button>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}

      {creditShortfallMessage ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {creditShortfallMessage}
          <Link className="ml-2 font-bold underline" href="/account/credits">
            查看点数
          </Link>
        </p>
      ) : null}

      {concept ? (
        <div className="mt-6 grid gap-3">
          {conceptSections.map((section) => (
            <div
              className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
              key={section.key}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {section.label}
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                {concept[section.key]}
              </p>
            </div>
          ))}

          <div className="rounded-md border border-[var(--line)] bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              读者追更问题
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 leading-7 text-[var(--ink)]">
              {concept.readerHookQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-bold text-[var(--ink)]">还没有作品设定</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            点击生成后，结果会写入 story_concepts，刷新页面后仍会显示。
          </p>
        </div>
      )}
    </section>
  );
}
