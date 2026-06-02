import { BookBadge, PaperPanel } from "@/components/ui/book";
import type { RouteAccent, RouteTendency } from "@/lib/interactive/types";

type RouteTendencyPanelProps = {
  tendencies: RouteTendency[];
};

const accentClasses: Record<RouteAccent, { bar: string; chip: string }> = {
  amber: {
    bar: "bg-[#b88a3d]",
    chip: "border-[#b88a3d] bg-[rgba(184,138,61,0.14)] text-[var(--gold-strong)]",
  },
  rose: {
    bar: "bg-[#b85555]",
    chip: "border-[#d9a2a2] bg-[rgba(184,85,85,0.12)] text-[#8d3434]",
  },
  teal: {
    bar: "bg-[#2f8f83]",
    chip: "border-[#8fcac1] bg-[rgba(47,143,131,0.12)] text-[#236b63]",
  },
  violet: {
    bar: "bg-[#8c5bd1]",
    chip: "border-[#c7b2e8] bg-[rgba(140,91,209,0.12)] text-[#6740a0]",
  },
};

function formatTrend(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function meterWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function RouteTendencyPanel({ tendencies }: RouteTendencyPanelProps) {
  const sortedTendencies = [...tendencies].sort((left, right) => right.score - left.score);

  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BookBadge tone="ink">Route Tendency</BookBadge>
          <h2 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">路线倾向</h2>
        </div>
        <BookBadge tone="gold">Mock Scores</BookBadge>
      </div>

      <div className="mt-5 grid gap-3">
        {sortedTendencies.map((tendency) => {
          const classes = accentClasses[tendency.accent];

          return (
            <article
              className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.62)] px-3 py-3"
              key={tendency.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-black text-[var(--ink)]">
                    {tendency.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {tendency.description}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-black ${classes.chip}`}>
                  {formatTrend(tendency.trend)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(75,46,29,0.12)]">
                  <div className={`h-full rounded-full ${classes.bar}`} style={{ width: meterWidth(tendency.score) }} />
                </div>
                <span className="w-9 text-right text-xs font-black text-[var(--ink)]">
                  {tendency.score}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </PaperPanel>
  );
}
