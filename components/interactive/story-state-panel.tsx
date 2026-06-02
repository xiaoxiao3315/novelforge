import { BookBadge, PaperPanel } from "@/components/ui/book";
import type { CharacterRelationship, StoryMeter } from "@/lib/interactive/types";

type StoryStatePanelProps = {
  clues: string[];
  flags: string[];
  meters: StoryMeter[];
  relationships: CharacterRelationship[];
};

function meterWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function StoryStatePanel({
  clues,
  flags,
  meters,
  relationships,
}: StoryStatePanelProps) {
  return (
    <PaperPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BookBadge tone="ink">Story State</BookBadge>
          <h2 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">故事状态</h2>
        </div>
        <BookBadge tone="success">{relationships.length} 名角色</BookBadge>
      </div>

      <div className="mt-5 grid gap-4">
        <section>
          <h3 className="text-xs font-black text-[var(--gold-strong)]">角色关系</h3>
          <div className="mt-3 grid gap-3">
            {relationships.map((relationship) => (
              <article
                className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.62)] px-3 py-3"
                key={relationship.character}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg font-black text-[var(--ink)]">
                      {relationship.character}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                      {relationship.role}
                    </p>
                  </div>
                  <BookBadge tone="paper">{relationship.status}</BookBadge>
                </div>
                <div className="mt-3 grid gap-2">
                  {[
                    ["亲近", relationship.affinity],
                    ["信任", relationship.trust],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between gap-3 text-xs font-bold text-[var(--muted)]">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[rgba(75,46,29,0.12)]">
                        <div
                          className="h-full rounded-full bg-[#2f8f83]"
                          style={{ width: meterWidth(Number(value)) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {relationship.recentChange}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black text-[var(--gold-strong)]">状态计量</h3>
          <div className="mt-3 grid gap-3">
            {meters.map((meter) => (
              <div
                className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.62)] px-3 py-3"
                key={meter.label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-[var(--ink)]">{meter.label}</p>
                  <span className="text-xs font-black text-[var(--gold-strong)]">
                    {meter.value}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(75,46,29,0.12)]">
                  <div
                    className="h-full rounded-full bg-[#8c5bd1]"
                    style={{ width: meterWidth(meter.value) }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{meter.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-black text-[var(--gold-strong)]">已触发标记</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {flags.map((flag) => (
                <BookBadge key={flag} tone="warning">
                  {flag}
                </BookBadge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black text-[var(--gold-strong)]">已获得线索</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {clues.map((clue) => (
                <BookBadge key={clue} tone="gold">
                  {clue}
                </BookBadge>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PaperPanel>
  );
}
