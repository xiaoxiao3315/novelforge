import { BookBadge, PaperPanel } from "@/components/ui/book";
import type { StoryRouteEvent, TimelineStatus } from "@/lib/interactive/types";

type StoryRouteTimelineProps = {
  events: StoryRouteEvent[];
};

const statusTone: Record<TimelineStatus, "gold" | "ink" | "paper" | "warning"> = {
  current: "warning",
  locked: "ink",
  past: "gold",
  possible: "paper",
};

const statusLabels: Record<TimelineStatus, string> = {
  current: "当前",
  locked: "锁定",
  past: "已发生",
  possible: "可能",
};

export function StoryRouteTimeline({ events }: StoryRouteTimelineProps) {
  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BookBadge tone="ink">Story Route</BookBadge>
          <h2 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">故事路线</h2>
        </div>
        <BookBadge tone="gold">{events.length} 个节点</BookBadge>
      </div>

      <div className="mt-6 grid gap-4">
        {events.map((event, index) => (
          <article className="grid gap-3 sm:grid-cols-[92px_1fr]" key={event.id}>
            <div className="flex items-start gap-3 sm:block">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--paper)] font-black text-[var(--brown)] shadow-[4px_5px_0_rgba(75,46,29,0.12)]">
                {index + 1}
              </div>
              <p className="mt-2 text-xs font-black text-[var(--gold-strong)] sm:mt-3">
                {event.chapterLabel}
              </p>
            </div>

            <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.62)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[var(--gold-strong)]">{event.route}</p>
                  <h3 className="mt-1 font-serif text-xl font-black text-[var(--ink)]">
                    {event.title}
                  </h3>
                </div>
                <BookBadge tone={statusTone[event.status]}>{statusLabels[event.status]}</BookBadge>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{event.summary}</p>
              {event.choice ? (
                <p className="mt-3 rounded-md border border-[var(--line)] bg-[rgba(255,255,255,0.35)] px-3 py-2 text-sm font-bold leading-6 text-[var(--ink-soft)]">
                  选择：{event.choice}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {event.consequences.map((consequence) => (
                  <BookBadge key={consequence} tone={event.status === "locked" ? "ink" : "paper"}>
                    {consequence}
                  </BookBadge>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </PaperPanel>
  );
}
