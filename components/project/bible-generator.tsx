"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENERATION_CREDIT_COSTS, formatCreditShortfall } from "@/lib/credits";
import { formatUserFacingError } from "@/lib/ui/errors";
import type { CharacterCard, StoryBible } from "@/prompts/bible";

type BibleGeneratorProps = {
  projectId: string;
  initialBible: StoryBible | null;
  initialCharacters: CharacterCard[];
  hasConcept: boolean;
  creditBalance: number | null;
};

type BibleResponse = {
  bible?: StoryBible;
  characters?: CharacterCard[];
  error?: string;
};

const bibleSections: Array<{
  key: keyof Omit<StoryBible, "immutableRules">;
  label: string;
}> = [
  { key: "worldview", label: "世界观" },
  { key: "powerSystem", label: "核心规则 / 力量系统" },
  { key: "majorFactions", label: "主要组织 / 势力" },
  { key: "mainPlot", label: "主线剧情" },
  { key: "firstVolumePlot", label: "第一卷主线" },
  { key: "protagonistArc", label: "主角成长线" },
  { key: "antagonistPlan", label: "反派计划" },
  { key: "midLateForeshadowing", label: "中后期伏笔" },
  { key: "finalTruth", label: "最终真相" },
];

const characterSections: Array<{
  key: keyof Omit<CharacterCard, "name">;
  label: string;
}> = [
  { key: "role", label: "角色定位" },
  { key: "appearance", label: "外貌特征" },
  { key: "personality", label: "性格" },
  { key: "goal", label: "目标" },
  { key: "weakness", label: "弱点" },
  { key: "secret", label: "秘密" },
  { key: "relationshipToProtagonist", label: "与主角关系" },
  { key: "characterArc", label: "成长线" },
];

export function BibleGenerator({
  projectId,
  initialBible,
  initialCharacters,
  hasConcept,
  creditBalance,
}: BibleGeneratorProps) {
  const [bible, setBible] = useState(initialBible);
  const [characters, setCharacters] = useState(initialCharacters);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const generationCost = GENERATION_CREDIT_COSTS.generate_bible;
  const hasEnoughCredits = creditBalance === null || creditBalance >= generationCost;
  const creditShortfallMessage =
    creditBalance === null || hasEnoughCredits
      ? ""
      : formatCreditShortfall(creditBalance, generationCost);

  async function generateBible() {
    if (!hasConcept) {
      setError("请先生成作品设定。");
      return;
    }

    if (!hasEnoughCredits) {
      setError(creditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate/bible", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      const payload = (await response.json().catch(() => null)) as BibleResponse | null;

      if (!response.ok || !payload?.bible || !payload.characters) {
        setError(formatUserFacingError(payload?.error, "故事圣经生成失败，请稍后重试。"));
        return;
      }

      setBible(payload.bible);
      setCharacters(payload.characters);
      router.refresh();
    } catch {
      setError("网络异常，故事圣经生成请求未完成，请检查网络后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--ink)]">故事圣经</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
            基于剧情筛选器和作品设定生成故事圣经与主要角色卡。生成可能需要几十秒；重新生成会覆盖当前故事圣经，并替换该项目角色卡。
          </p>
        </div>
        <button
          className="button-primary"
          disabled={isGenerating || !hasConcept || !hasEnoughCredits}
          onClick={generateBible}
          type="button"
        >
          {isGenerating
            ? "生成中..."
            : bible
              ? `重新生成 · ${generationCost} 点`
              : `生成故事圣经 · ${generationCost} 点`}
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

      {!hasConcept ? (
        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-bold text-[var(--ink)]">需要先生成作品设定</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            故事圣经会基于已保存的 story_config 和 story_concept 生成。
          </p>
        </div>
      ) : bible ? (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-3">
            {bibleSections.map((section) => (
              <div
                className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
                key={section.key}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  {section.label}
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                  {bible[section.key]}
                </p>
              </div>
            ))}

            <div className="rounded-md border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                不可变规则
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 leading-7 text-[var(--ink)]">
                {bible.immutableRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-black text-[var(--ink)]">主要角色卡</h3>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {characters.map((character) => (
                <article
                  className="rounded-md border border-[var(--line)] bg-white px-4 py-3"
                  key={character.name}
                >
                  <h4 className="text-lg font-black text-[var(--ink)]">{character.name}</h4>
                  <div className="mt-3 grid gap-3">
                    {characterSections.map((section) => (
                      <div key={section.key}>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                          {section.label}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap leading-7 text-[var(--ink)]">
                          {character[section.key]}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-white/70 p-6 text-center">
          <p className="font-bold text-[var(--ink)]">还没有故事圣经</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            点击生成后，结果会写入 story_bibles 和 characters，刷新页面后仍会显示。
          </p>
        </div>
      )}
    </section>
  );
}
