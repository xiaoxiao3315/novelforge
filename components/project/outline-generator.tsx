"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterContent } from "@/prompts/chapter";
import type { ChapterOutline, VolumeOutline } from "@/prompts/outline";

type ChapterDisplay = ChapterContent & {
  id?: string;
};

type OutlineGeneratorProps = {
  projectId: string;
  initialVolume: VolumeOutline | null;
  initialChapters: ChapterDisplay[];
  hasPrerequisites: boolean;
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

export function OutlineGenerator({
  projectId,
  initialVolume,
  initialChapters,
  hasPrerequisites,
}: OutlineGeneratorProps) {
  const [volume, setVolume] = useState(initialVolume);
  const [chapters, setChapters] = useState(initialChapters);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChapterNumber, setGeneratingChapterNumber] = useState<number | null>(null);
  const router = useRouter();

  async function generateOutline() {
    if (!hasPrerequisites) {
      setError("请先完成作品设定、故事圣经和角色卡。");
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
    router.refresh();
  }

  async function generateChapter(chapter: ChapterDisplay) {
    setError("");
    setGeneratingChapterNumber(chapter.chapterNumber);

    const response = await fetch("/api/generate/chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
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

    setChapters((currentChapters) =>
      currentChapters.map((currentChapter) =>
        currentChapter.chapterNumber === generatedChapter.chapterNumber
          ? generatedChapter
          : currentChapter,
      ),
    );
    router.refresh();
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
          disabled={isGenerating || !hasPrerequisites}
          onClick={generateOutline}
          type="button"
        >
          {isGenerating ? "生成中..." : volume ? "重新生成" : "生成章节大纲"}
        </button>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
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
                    <button
                      className="button-secondary min-h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={generatingChapterNumber !== null}
                      onClick={() => generateChapter(chapter)}
                      type="button"
                    >
                      {generatingChapterNumber === chapter.chapterNumber
                        ? "正文生成中..."
                        : chapter.draft?.body
                          ? "重新生成正文"
                          : "生成正文"}
                    </button>
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

                {chapter.draft?.body ? (
                  <div className="mt-5 border-t border-[var(--line)] pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      章节正文
                    </p>
                    <div className="mt-3 whitespace-pre-wrap rounded-md bg-[#fffaf0] px-4 py-4 leading-8 text-[var(--ink)]">
                      {chapter.draft.body}
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
