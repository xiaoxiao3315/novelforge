import type { Metadata } from "next";
import {
  ChapterEndDecisionCard,
  ImmersiveReader,
  RouteTendencyPanel,
  StoryRouteTimeline,
  StoryStatePanel,
} from "@/components/interactive";
import { BookBadge, PaperPanel, StatusBookmark } from "@/components/ui/book";
import { interactiveStoryMock } from "@/lib/interactive/mock-data";

export const metadata: Metadata = {
  title: "Interactive Story Preview / NovelForge",
  description: "Development-only preview for the interactive story module prototype.",
};

export default function InteractivePreviewPage() {
  const story = interactiveStoryMock;
  const selectedOption =
    story.chapterDecision.options.find((option) => option.id === story.selectedOptionId) ??
    story.chapterDecision.options[0];

  return (
    <main className="app-shell py-8">
      <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBookmark tone="gold">DEV PREVIEW</StatusBookmark>
            <BookBadge tone="warning">Mock Only</BookBadge>
            <BookBadge tone="paper">No API / DB / DeepSeek</BookBadge>
          </div>
          <h1 className="mt-8 font-serif text-5xl font-black leading-tight text-[var(--ink)] md:text-6xl">
            {story.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-9 text-[var(--muted)]">{story.premise}</p>
        </div>

        <PaperPanel className="p-5">
          <p className="text-sm font-black uppercase text-[var(--gold-strong)]">
            Selected Branch
          </p>
          <h2 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            {selectedOption.label}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {selectedOption.routeHint}
          </p>
          <div className="mt-4 grid gap-2">
            {selectedOption.effects.map((effect) => (
              <div
                className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2"
                key={`${effect.kind}-${effect.target}`}
              >
                <p className="text-xs font-black text-[var(--gold-strong)]">{effect.target}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{effect.note}</p>
              </div>
            ))}
          </div>
        </PaperPanel>
      </section>

      <section className="grid items-start gap-5 pb-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ImmersiveReader chapter={story.currentChapter} selectedOption={selectedOption}>
            <ChapterEndDecisionCard
              decision={story.chapterDecision}
              initialSelectedOptionId={story.selectedOptionId}
            />
          </ImmersiveReader>
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-6">
          <StoryStatePanel
            clues={story.clues}
            flags={story.flags}
            meters={story.meters}
            relationships={story.relationships}
          />
          <RouteTendencyPanel tendencies={story.routeTendencies} />
        </aside>
      </section>

      <section className="pb-12">
        <StoryRouteTimeline events={story.routeTimeline} />
      </section>
    </main>
  );
}
