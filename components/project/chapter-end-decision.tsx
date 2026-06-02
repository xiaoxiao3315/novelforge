"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookBadge, PaperPanel } from "@/components/ui/book";
import { formatUserFacingError } from "@/lib/ui/errors";
import {
  CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT,
  hasSelectedChapterDecision,
  type ChapterDecision,
  type ChapterDecisionOptionId,
} from "@/prompts/chapter-decision";
import {
  hasStoryStateChanges,
  type InteractiveStoryState,
  type StoryStateChanges,
} from "@/prompts/story-state";

type DecisionResponse = {
  chapterId?: string;
  decision?: ChapterDecision;
  interactiveState?: InteractiveStoryState;
  stateChanges?: StoryStateChanges;
  error?: string;
};

type ChapterEndDecisionProps = {
  chapterId: string;
  chapterNumber: number;
  initialDecision?: ChapterDecision | null;
  initialInteractiveState?: InteractiveStoryState | null;
  initialStateChanges?: StoryStateChanges | null;
  nextChapter?: NextChapterHint | null;
  projectId: string;
};

export type NextChapterHint = {
  anchorId: string;
  chapterNumber: number;
  hasBody: boolean;
  title: string;
};

function formatChangeValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

type StateChangeItem = {
  name?: string;
  key?: string;
  change?: number;
  value?: boolean;
  reason?: string;
  status?: string;
  note?: string;
};

function formatStateValue(value: boolean | number | string) {
  if (typeof value === "boolean") {
    return value ? "已点亮" : "未触发";
  }

  return String(value);
}

function hasInteractiveStateValues(interactiveState: InteractiveStoryState | null) {
  if (!interactiveState) {
    return false;
  }

  return (
    Object.keys(interactiveState.relationships).length > 0 ||
    Object.keys(interactiveState.meters).length > 0 ||
    Object.keys(interactiveState.flags).length > 0 ||
    Object.keys(interactiveState.clues).length > 0 ||
    Object.keys(interactiveState.routeTendency).length > 0
  );
}

function StateChangeList({
  emptyText = "暂无变化。",
  items,
  renderValue,
}: {
  emptyText?: string;
  items: StateChangeItem[];
  renderValue?: (item: StateChangeItem) => string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const title = item.name ?? item.key ?? "状态变化";

        return (
          <div
            className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-2"
            key={`${title}-${item.change ?? item.status ?? item.value ?? ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-bold text-[var(--ink)]">{title}</p>
              {renderValue ? (
                <span className="shrink-0 text-xs font-black text-[var(--gold-strong)]">
                  {renderValue(item)}
                </span>
              ) : null}
            </div>
            {item.reason || item.note ? (
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {item.reason ?? item.note}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ChapterStateChangesPanel({ stateChanges }: { stateChanges: StoryStateChanges | null }) {
  const hasChanges = Boolean(stateChanges && hasStoryStateChanges(stateChanges));
  const relationships = stateChanges?.relationships ?? [];
  const meters = stateChanges?.meters ?? [];
  const clues = stateChanges?.clues ?? [];
  const routeTendency = stateChanges?.routeTendency ?? [];
  const storyImpactGroups = [
    {
      emptyText: "这次选择暂时没有改变角色羁绊。",
      items: relationships.slice(0, 2),
      label: "羁绊变化",
      renderValue: (item: StateChangeItem) => formatChangeValue(item.change ?? 0),
    },
    {
      emptyText: "压力和风险还没有明显波动。",
      items: meters.slice(0, 2),
      label: "压力与风险",
      renderValue: (item: StateChangeItem) => formatChangeValue(item.change ?? 0),
    },
    {
      emptyText: "还没有被点亮的新线索。",
      items: clues.slice(0, 2),
      label: "被点亮的线索",
      renderValue: (item: StateChangeItem) => item.status ?? "已记录",
    },
    {
      emptyText: "命运倾向还没有明显变化。",
      items: routeTendency.slice(0, 2),
      label: "命运倾向",
      renderValue: (item: StateChangeItem) => formatChangeValue(item.change ?? 0),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.55)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-serif text-lg font-black text-[var(--ink)]">
          命运回声
        </h4>
        <BookBadge tone="warning">故事会记住</BookBadge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        只保留最重要的故事反馈；下一章会沿着这些回声继续。
      </p>
      {storyImpactGroups.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {storyImpactGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">{group.label}</p>
              <StateChangeList
                emptyText={group.emptyText}
                items={group.items}
                renderValue={group.renderValue}
              />
            </div>
          ))}
        </div>
      ) : hasChanges ? (
        <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-3 text-sm leading-6 text-[var(--muted)]">
          这次选择已被故事记住，主要影响会在后续章节中显现。
        </p>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-3 text-sm leading-6 text-[var(--muted)]">
          做出选择后，这里会显示它带来的涟漪。
        </p>
      )}
    </div>
  );
}

function StateValuePills({
  emptyText,
  items,
}: {
  emptyText: string;
  items: Array<[string, boolean | number | string]>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 5).map(([name, value]) => (
        <span
          className="rounded-sm border border-[var(--line)] bg-[rgba(255,248,234,0.88)] px-2 py-1 text-xs font-bold text-[var(--ink)]"
          key={name}
        >
          {name} {formatStateValue(value)}
        </span>
      ))}
    </div>
  );
}

function InteractiveStateAfterSave({
  interactiveState,
}: {
  interactiveState: InteractiveStoryState | null;
}) {
  const hasValues = hasInteractiveStateValues(interactiveState);

  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,244,220,0.72)] p-4">
      <h4 className="font-serif text-lg font-black text-[var(--ink)]">命运正在留下痕迹</h4>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        下一章会继承这些羁绊、风险、线索和命运倾向。
      </p>
      {hasValues && interactiveState ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">羁绊变化</p>
            <StateValuePills
              emptyText="还没有可见的羁绊变化。"
              items={Object.entries(interactiveState.relationships)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">压力与风险</p>
            <StateValuePills
              emptyText="压力和风险暂时平稳。"
              items={Object.entries(interactiveState.meters)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">被点亮的线索</p>
            <StateValuePills
              emptyText="还没有线索被点亮。"
              items={Object.entries(interactiveState.clues)}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">命运倾向</p>
            <StateValuePills
              emptyText="命运倾向还没有成形。"
              items={Object.entries(interactiveState.routeTendency)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.58)] px-3 py-3 text-sm leading-6 text-[var(--muted)]">
          你的故事状态还没有被命运改变。
        </p>
      )}
    </div>
  );
}

function FateFlowGuide({ hasDecision, hasSavedDecision }: { hasDecision: boolean; hasSavedDecision: boolean }) {
  const steps = [
    {
      active: true,
      label: "阅读本章",
      note: "先读完这一章的选择前夜。",
    },
    {
      active: hasDecision || hasSavedDecision,
      label: "做出选择",
      note: "读完后选择你要走向的下一条命运。",
    },
    {
      active: hasSavedDecision,
      label: "命运改变",
      note: "角色关系、风险和线索会留下痕迹。",
    },
    {
      active: hasSavedDecision,
      label: "继续下一章",
      note: "下一章将继承这次选择继续。",
    },
  ];

  return (
    <div className="mt-5 grid gap-2 md:grid-cols-4">
      {steps.map((step, index) => (
        <div
          className={`rounded-md border px-3 py-3 ${
            step.active
              ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]"
              : "border-[var(--line)] bg-[rgba(255,248,234,0.58)]"
          }`}
          key={step.label}
        >
          <p className="text-xs font-black text-[var(--gold-strong)]">
            {index + 1}. {step.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.note}</p>
        </div>
      ))}
    </div>
  );
}

function getChoiceImpactSummary(
  stateChanges: StoryStateChanges | null,
  expectedEffects: string[],
) {
  const impactSummary: string[] = [];
  const relationship = stateChanges?.relationships[0];
  const meter = stateChanges?.meters[0];
  const clue = stateChanges?.clues[0];
  const route = stateChanges?.routeTendency[0];

  if (relationship) {
    impactSummary.push(`羁绊变化：${relationship.name} ${formatChangeValue(relationship.change)}`);
  }

  if (meter) {
    impactSummary.push(`压力与风险：${meter.name} ${formatChangeValue(meter.change)}`);
  }

  if (clue) {
    impactSummary.push(`被点亮的线索：${clue.name} ${clue.status}`);
  }

  if (route) {
    impactSummary.push(`命运倾向：${route.name} ${formatChangeValue(route.change)}`);
  }

  return [...impactSummary, ...expectedEffects.map((effect) => `预期回声：${effect}`)].slice(0, 4);
}

function NextChapterGuide({ nextChapter }: { nextChapter?: NextChapterHint | null }) {
  const href = nextChapter ? `#${nextChapter.anchorId}` : "#story-director";
  const body = nextChapter
    ? nextChapter.hasBody
      ? `第 ${nextChapter.chapterNumber} 章《${nextChapter.title}》已有正文，可以从目录卡片继续阅读。`
      : `第 ${nextChapter.chapterNumber} 章《${nextChapter.title}》已在目录中，正文尚未开启；使用故事导演台继续进入本章。`
    : "下一章还没有出现在目录中；回到故事导演台继续铺开命运。";

  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
      <p className="font-serif text-lg font-black text-[var(--ink)]">
        沿这条命运继续下一章
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
      <a className="button-primary mt-4 min-h-11 px-4 text-sm" href={href}>
        沿这条命运继续下一章
      </a>
    </div>
  );
}

function ChoiceConfirmationPanel({
  customChoice,
  decision,
  selectedOptionId,
  stateChanges,
}: {
  customChoice: string;
  decision: ChapterDecision;
  selectedOptionId: ChapterDecisionOptionId | "";
  stateChanges: StoryStateChanges | null;
}) {
  const selectedOption = decision.options.find((option) => option.id === selectedOptionId);
  const trimmedCustomChoice = customChoice.trim();
  const selectedText = selectedOption
    ? `${selectedOption.id}. ${selectedOption.label}`
    : trimmedCustomChoice || "自定义命运";
  const impactSummary = getChoiceImpactSummary(
    stateChanges,
    selectedOption?.expectedEffects ?? [],
  );

  return (
    <div className="rounded-md border border-[#b8d8c7] bg-[#f0fbf5] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-serif text-lg font-black text-[var(--ink)]">
          命运已写入故事
        </h4>
        <BookBadge tone="success">这条命运已确认</BookBadge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        这条命运已经确认。下一章将继承这个选择。
      </p>
      <div className="mt-3 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.8)] px-3 py-3">
        <p className="text-xs font-black text-[var(--gold-strong)]">你选择了</p>
        <p className="mt-1 text-sm font-bold leading-6 text-[var(--ink)]">{selectedText}</p>
        {trimmedCustomChoice && selectedOption ? (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            自定义补充：{trimmedCustomChoice}
          </p>
        ) : null}
      </div>
      <div className="mt-3 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-3 py-3">
        <p className="text-xs font-black text-[var(--gold-strong)]">主要影响摘要</p>
        {impactSummary.length > 0 ? (
          <div className="mt-2 grid gap-2">
            {impactSummary.map((impact) => (
              <p
                className="rounded-sm bg-[rgba(255,255,255,0.52)] px-2 py-1 text-xs font-bold leading-5 text-[var(--ink)]"
                key={impact}
              >
                {impact}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            主要影响已经被故事记住，下一章会在关系、风险和线索中回应它。
          </p>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        下一章将沿着这条命运继续。
      </p>
    </div>
  );
}

export function ChapterEndDecision({
  chapterId,
  chapterNumber,
  initialDecision,
  initialInteractiveState,
  initialStateChanges,
  nextChapter,
  projectId,
}: ChapterEndDecisionProps) {
  const [decision, setDecision] = useState(initialDecision ?? null);
  const [interactiveState, setInteractiveState] = useState(initialInteractiveState ?? null);
  const [stateChanges, setStateChanges] = useState(initialStateChanges ?? null);
  const [selectedOptionId, setSelectedOptionId] = useState<ChapterDecisionOptionId | "">(
    initialDecision?.selectedOptionId ?? "",
  );
  const [customChoice, setCustomChoice] = useState(initialDecision?.customChoice ?? "");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const hasSavedDecision = decision ? hasSelectedChapterDecision(decision) : false;
  const hasPendingChoice = decision
    ? (selectedOptionId || "") !== (decision.selectedOptionId ?? "") ||
      customChoice.trim() !== (decision.customChoice ?? "").trim()
    : false;
  const decisionStatus = hasPendingChoice
    ? {
        body: "点击“确认这条命运”后，故事才会把这条路写入下一章。",
        className: "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]",
        title: "这段故事还没有落定",
      }
    : hasSavedDecision
      ? {
          body: "命运已写入故事。下一章将沿用这条命运继续。",
          className: "border-[#b8d8c7] bg-[#f0fbf5]",
          title: "命运已写入故事",
      }
    : {
        body: "这段故事还没有落定。读完本章后，选择你想走向的命运。",
        className: "border-[var(--line)] bg-[rgba(255,248,234,0.68)]",
        title: "选择尚未落定",
      };

  async function generateDecision() {
    setError("");
    setIsGenerating(true);

    const response = await fetch("/api/generate/chapter-decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId,
        chapterNumber,
      }),
    });
    const payload = (await response.json().catch(() => null)) as DecisionResponse | null;

    setIsGenerating(false);

    if (!response.ok || !payload?.decision) {
      setError(formatUserFacingError(payload?.error, "命运分歧暂未浮现，请稍后重试。"));
      return;
    }

    setDecision(payload.decision);
    setStateChanges(payload.stateChanges ?? null);
    setSelectedOptionId(payload.decision.selectedOptionId ?? "");
    setCustomChoice(payload.decision.customChoice ?? "");
    router.refresh();
  }

  async function saveDecision() {
    if (!decision) {
      setError("请先开启命运分歧。");
      return;
    }

    if (!selectedOptionId && !customChoice.trim()) {
      setError("请先选定一个方向，或写下自定义命运。");
      return;
    }

    setError("");
    setIsSaving(true);

    const response = await fetch("/api/chapters/select-decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId,
        optionId: selectedOptionId || null,
        customChoice,
      }),
    });
    const payload = (await response.json().catch(() => null)) as DecisionResponse | null;

    setIsSaving(false);

    if (!response.ok || !payload?.decision) {
      setError(formatUserFacingError(payload?.error, "这条命运确认失败，请稍后重试。"));
      return;
    }

    setDecision(payload.decision);
    setInteractiveState(payload.interactiveState ?? interactiveState);
    setStateChanges(payload.stateChanges ?? stateChanges);
    setSelectedOptionId(payload.decision.selectedOptionId ?? "");
    setCustomChoice(payload.decision.customChoice ?? "");
    router.refresh();
  }

  return (
    <PaperPanel className="mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookBadge tone="warning">命运分歧</BookBadge>
          <h3 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            命运分歧
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            读完本章后，选择你要走向的下一条命运。
          </p>
        </div>
        <button
          className="button-secondary min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || isSaving}
          onClick={generateDecision}
          type="button"
        >
          {isGenerating
            ? "命运分歧浮现中..."
            : decision
              ? "重新召唤命运分歧"
              : "让命运分歧浮现"}
        </button>
      </div>

      <FateFlowGuide hasDecision={Boolean(decision)} hasSavedDecision={hasSavedDecision} />

      {error ? (
        <p className="mt-4 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}

      {decision ? (
        <div className="mt-5 grid gap-4">
          <p className="font-bold leading-7 text-[var(--ink)]">{decision.question}</p>

          <div className="grid gap-3 lg:grid-cols-3">
            {decision.options.map((option) => (
              <label
                className={`cursor-pointer rounded-md border px-3 py-3 transition ${
                  selectedOptionId === option.id
                    ? "border-[var(--gold)] bg-[rgba(255,244,220,0.92)] shadow-sm"
                    : "border-[var(--line)] bg-[rgba(255,248,234,0.68)]"
                }`}
                key={option.id}
              >
                <span className="flex items-start gap-2">
                  <input
                    checked={selectedOptionId === option.id}
                    className="mt-1"
                    disabled={isSaving}
                    name={`chapter-end-decision-${chapterId}`}
                    onChange={() => setSelectedOptionId(option.id)}
                    type="radio"
                    value={option.id}
                  />
                  <span>
                    <span className="block font-black text-[var(--ink)]">
                      命运 {option.id} · {option.label}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                      {option.description}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                      可能带来的回声：{option.expectedEffects.join("；")}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">
              自定义命运
            </span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.82)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none transition focus:border-[var(--gold)]"
              disabled={isSaving}
              maxLength={CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
              onChange={(event) => setCustomChoice(event.target.value)}
              placeholder="如果三个选项都不够贴合，可以写下你希望主角做出的决定。"
              rows={3}
              value={customChoice}
            />
            <span className="text-right text-xs font-bold text-[var(--muted)]">
              {customChoice.length}/{CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT}
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={`rounded-md border px-3 py-3 text-sm leading-6 ${decisionStatus.className}`}
            >
              <p className="font-black text-[var(--ink)]">{decisionStatus.title}</p>
              <p className="mt-1 text-[var(--muted)]">{decisionStatus.body}</p>
            </div>
            <button
              className="button-primary min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={saveDecision}
              type="button"
            >
              {isSaving ? "正在写入故事..." : "确认这条命运"}
            </button>
          </div>
          {hasSavedDecision && decision ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
              <ChoiceConfirmationPanel
                customChoice={customChoice}
                decision={decision}
                selectedOptionId={selectedOptionId}
                stateChanges={stateChanges}
              />
              <NextChapterGuide nextChapter={nextChapter} />
            </div>
          ) : null}
          <ChapterStateChangesPanel stateChanges={stateChanges} />
          <InteractiveStateAfterSave interactiveState={interactiveState} />
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-7 text-[var(--muted)]">
          本章的命运分歧尚未浮现。读完正文后，可以让故事给出下一步选择。
        </div>
      )}
    </PaperPanel>
  );
}
