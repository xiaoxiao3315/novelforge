"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENERATION_CREDIT_COSTS, formatCreditShortfall } from "@/lib/credits";
import {
  CHAPTER_INTERVENTION_LIMITS,
  EMPTY_CHAPTER_INTERVENTION,
  type ChapterContent,
  type ChapterIntervention,
} from "@/prompts/chapter";
import type { ChapterOutline, VolumeOutline } from "@/prompts/outline";

type ChapterDisplay = ChapterContent & {
  id?: string;
};

type OutlineGeneratorProps = {
  projectId: string;
  initialVolume: VolumeOutline | null;
  initialChapters: ChapterDisplay[];
  hasPrerequisites: boolean;
  creditBalance: number | null;
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

type SetOfficialResponse = {
  chapterId?: string;
  versionId?: string;
  official?: NonNullable<ChapterContent["official"]>;
  error?: string;
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

function formatSummaryValue(value: string | string[]) {
  return Array.isArray(value) ? value.join("；") : value;
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

function getInitialInterventions(chapters: ChapterDisplay[]) {
  return Object.fromEntries(
    chapters.map((chapter) => [
      chapterKey(chapter),
      chapter.draft?.intervention ?? { ...EMPTY_CHAPTER_INTERVENTION },
    ]),
  ) as Record<string, ChapterIntervention>;
}

export function OutlineGenerator({
  projectId,
  initialVolume,
  initialChapters,
  hasPrerequisites,
  creditBalance,
}: OutlineGeneratorProps) {
  const [volume, setVolume] = useState(initialVolume);
  const [chapters, setChapters] = useState(initialChapters);
  const [interventions, setInterventions] = useState(() =>
    getInitialInterventions(initialChapters),
  );
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChapterNumber, setGeneratingChapterNumber] = useState<number | null>(null);
  const [settingOfficialChapterNumber, setSettingOfficialChapterNumber] = useState<number | null>(
    null,
  );
  const router = useRouter();
  const outlineCost = GENERATION_CREDIT_COSTS.generate_outline;
  const chapterCost = GENERATION_CREDIT_COSTS.generate_chapter;
  const hasEnoughOutlineCredits = creditBalance === null || creditBalance >= outlineCost;
  const hasEnoughChapterCredits = creditBalance === null || creditBalance >= chapterCost;
  const outlineCreditShortfallMessage =
    creditBalance === null || hasEnoughOutlineCredits
      ? ""
      : formatCreditShortfall(creditBalance, outlineCost);
  const chapterCreditShortfallMessage =
    creditBalance === null || hasEnoughChapterCredits
      ? ""
      : formatCreditShortfall(creditBalance, chapterCost);

  async function generateOutline() {
    if (!hasPrerequisites) {
      setError("请先完成作品设定、故事圣经和角色卡。");
      return;
    }

    if (!hasEnoughOutlineCredits) {
      setError(outlineCreditShortfallMessage);
      return;
    }

    setError("");
    setIsGenerating(true);

    const response = await fetch("/api/generate/outline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    });

    const payload = (await response.json().catch(() => null)) as OutlineResponse | null;

    setIsGenerating(false);

    if (!response.ok || !payload?.volume || !payload.chapters) {
      setError(payload?.error || "章节大纲生成失败，请稍后重试。");
      return;
    }

    setVolume(payload.volume);
    setChapters(payload.chapters);
    setInterventions(getInitialInterventions(payload.chapters));
    router.refresh();
  }

  async function generateChapter(chapter: ChapterDisplay) {
    if (!hasEnoughChapterCredits) {
      setError(chapterCreditShortfallMessage);
      return;
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
      }),
    });

    const payload = (await response.json().catch(() => null)) as ChapterResponse | null;

    setGeneratingChapterNumber(null);

    if (!response.ok || !payload?.chapter) {
      setError(payload?.error || "章节正文生成失败，请稍后重试。");
      return;
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
    router.refresh();
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
      setError(payload?.error || "正式稿设置失败，请稍后重试。");
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

  return (
    <section className="surface mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--ink)]">章节大纲</h2>
          <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">
            基于已保存的 story_config、story_concept、story_bible 和 characters 生成第一卷 20 章大纲。重新生成会覆盖当前卷信息和章节大纲，并记录生成日志。
          </p>
        </div>
        <button
          className="button-primary"
          disabled={isGenerating || !hasPrerequisites || !hasEnoughOutlineCredits}
          onClick={generateOutline}
          type="button"
        >
          {isGenerating
            ? "生成中..."
            : volume
              ? `重新生成 · ${outlineCost} 点`
              : `生成章节大纲 · ${outlineCost} 点`}
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
            查看点数
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
            {chapters.map((chapter) => (
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
                        generatingChapterNumber !== null ||
                        settingOfficialChapterNumber !== null ||
                        !hasEnoughChapterCredits
                      }
                      onClick={() => generateChapter(chapter)}
                      type="button"
                    >
                      {generatingChapterNumber === chapter.chapterNumber
                        ? "正文生成中..."
                        : chapter.draft?.body
                          ? `重新生成正文 · ${chapterCost} 点`
                          : `生成正文 · ${chapterCost} 点`}
                    </button>
                    {chapter.draft?.body ? (
                      <button
                        className="button-primary min-h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          !chapter.draft.versionId ||
                          chapter.official?.versionId === chapter.draft.versionId ||
                          generatingChapterNumber !== null ||
                          settingOfficialChapterNumber !== null
                        }
                        onClick={() => setOfficialChapter(chapter)}
                        type="button"
                      >
                        {settingOfficialChapterNumber === chapter.chapterNumber
                          ? "确认中..."
                          : chapter.official?.versionId === chapter.draft.versionId
                            ? "当前为正式稿"
                            : "设为正式稿"}
                      </button>
                    ) : null}
                  </div>
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
                          disabled={generatingChapterNumber !== null}
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
            ))}
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
