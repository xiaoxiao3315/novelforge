import type { ReactNode } from "react";
import { BookBadge, ReaderPage, StatusBookmark } from "@/components/ui/book";
import type { DecisionOption, InteractiveChapter } from "@/lib/interactive/types";

type ImmersiveReaderProps = {
  chapter: InteractiveChapter;
  selectedOption?: DecisionOption;
  children?: ReactNode;
};

export function ImmersiveReader({ chapter, children, selectedOption }: ImmersiveReaderProps) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBookmark tone="ink">Immersive Reader</StatusBookmark>
        <BookBadge tone="gold">{chapter.volumeTitle}</BookBadge>
        {selectedOption ? <BookBadge tone="warning">当前倾向 {selectedOption.id}</BookBadge> : null}
      </div>

      <ReaderPage
        className="max-w-none"
        footer={
          <span>
            约 {chapter.readTimeMinutes} 分钟阅读
            {selectedOption ? ` · 已预览选择：${selectedOption.label}` : ""}
          </span>
        }
        title={
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-[var(--gold-strong)]">
                第 {chapter.chapterNumber} 章
              </p>
              <h1 className="mt-2 font-serif text-3xl font-black leading-tight text-[var(--ink)]">
                {chapter.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {chapter.subtitle}
              </p>
            </div>
            <BookBadge tone="paper">Mock Chapter</BookBadge>
          </div>
        }
      >
        <div className="whitespace-pre-wrap">
          {chapter.body.map((paragraph) => (
            <p className="mb-5 last:mb-0" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <p className="mt-8 rounded-md border border-[var(--line)] bg-[rgba(255,244,220,0.72)] px-4 py-3 text-base font-bold leading-8 text-[var(--ink-soft)]">
            {chapter.endingBeat}
          </p>
        </div>
      </ReaderPage>

      {children}
    </section>
  );
}
