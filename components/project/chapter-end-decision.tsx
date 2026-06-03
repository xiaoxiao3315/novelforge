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
  projectId: string;
};

function formatChangeValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function StateChangeList({
  items,
  renderValue,
}: {
  items: Array<{
    name?: string;
    key?: string;
    change?: number;
    value?: boolean;
    reason?: string;
    status?: string;
    note?: string;
  }>;
  renderValue?: (item: {
    name?: string;
    key?: string;
    change?: number;
    value?: boolean;
    reason?: string;
    status?: string;
    note?: string;
  }) => string;
}) {
  if (items.length === 0) {
    return null;
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
  if (!stateChanges || !hasStoryStateChanges(stateChanges)) {
    return null;
  }

  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.55)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-serif text-lg font-black text-[var(--ink)]">
          这次选择掀起的涟漪
        </h4>
        <BookBadge tone="warning">写入故事状态</BookBadge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        下一章会感知这些关系、压力和线索变化。
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">羁绊变化</p>
          <StateChangeList
            items={stateChanges.relationships}
            renderValue={(item) => formatChangeValue(item.change ?? 0)}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">压力与风险</p>
          <StateChangeList
            items={stateChanges.meters}
            renderValue={(item) => formatChangeValue(item.change ?? 0)}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">被点亮的线索</p>
          <StateChangeList
            items={[...stateChanges.flags, ...stateChanges.clues]}
            renderValue={(item) =>
              item.status ?? (item.value === undefined ? "已记录" : item.value ? "是" : "否")
            }
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-black text-[var(--gold-strong)]">故事倾向</p>
          <StateChangeList
            items={stateChanges.routeTendency}
            renderValue={(item) => formatChangeValue(item.change ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}

function InteractiveStateAfterSave({
  interactiveState,
}: {
  interactiveState: InteractiveStoryState | null;
}) {
  if (!interactiveState) {
    return null;
  }

  const previewItems = [
    ...Object.entries(interactiveState.relationships).map(([name, value]) => [name, value] as const),
    ...Object.entries(interactiveState.meters).map(([name, value]) => [name, value] as const),
    ...Object.entries(interactiveState.routeTendency).map(
      ([name, value]) => [name, value] as const,
    ),
  ].slice(0, 6);

  if (previewItems.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,244,220,0.72)] p-4">
      <h4 className="font-serif text-lg font-black text-[var(--ink)]">故事火种已更新</h4>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        下一章会带着这些关系、风险和线索继续推进。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {previewItems.map(([name, value], index) => (
          <span
            className="rounded-sm border border-[var(--line)] bg-[rgba(255,248,234,0.88)] px-2 py-1 text-xs font-bold text-[var(--ink)]"
            key={`${name}-${index}`}
          >
            {name} {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function getSelectedChoiceLabel(decision: ChapterDecision) {
  const selectedOption = decision.selectedOptionId
    ? decision.options.find((option) => option.id === decision.selectedOptionId)
    : null;
  const customChoice = decision.customChoice.trim();

  if (customChoice) {
    return customChoice;
  }

  if (selectedOption) {
    return `${selectedOption.id}. ${selectedOption.label}`;
  }

  return "这条命运";
}

function getPrimaryImpactSummary(stateChanges: StoryStateChanges | null) {
  if (!stateChanges || !hasStoryStateChanges(stateChanges)) {
    return ["角色关系和故事状态已更新，下一章会继承这次选择。"];
  }

  return [
    ...stateChanges.relationships.map(
      (item) => `羁绊变化：${item.name} ${formatChangeValue(item.change)}`,
    ),
    ...stateChanges.meters.map(
      (item) => `压力与风险：${item.name} ${formatChangeValue(item.change)}`,
    ),
    ...stateChanges.clues.map((item) => `被点亮的线索：${item.name} ${item.status}`),
    ...stateChanges.routeTendency.map(
      (item) => `命运倾向：${item.name} ${formatChangeValue(item.change)}`,
    ),
    ...stateChanges.flags.map((item) => `故事标记：${item.key}${item.value ? " 已触发" : ""}`),
  ].slice(0, 4);
}

export function ChapterEndDecision({
  chapterId,
  chapterNumber,
  initialDecision,
  initialInteractiveState,
  initialStateChanges,
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
        body: "点击“做出选择”后，故事才会把这条路写入下一章。",
        className: "border-[var(--gold)] bg-[rgba(255,244,220,0.9)]",
        title: "有新的选择待确认",
      }
    : hasSavedDecision
      ? {
          body: "下一章会沿用上一章选择和当前故事状态继续推进。",
          className: "border-[#b8d8c7] bg-[#f0fbf5]",
          title: "这条命运已确认",
        }
      : {
          body: "读完正文后选择一个方向，也可以写下自定义命运。",
          className: "border-[var(--line)] bg-[rgba(255,248,234,0.68)]",
          title: "选择尚未落定",
        };
  const selectedChoiceLabel = decision ? getSelectedChoiceLabel(decision) : "";
  const primaryImpactSummary = getPrimaryImpactSummary(stateChanges);

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
      setError(formatUserFacingError(payload?.error, "命运分歧生成失败，请稍后重试。"));
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
    <PaperPanel className="chapter-decision-panel mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BookBadge tone="warning">命运分歧</BookBadge>
          <h3 className="mt-3 font-serif text-2xl font-black text-[var(--ink)]">
            读完之后，选一条路
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            做出选择后，下一章会沿用这次选择和当前故事状态继续推进。
          </p>
        </div>
        <button
          className="button-secondary min-h-10 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || isSaving}
          onClick={generateDecision}
          type="button"
        >
          {isGenerating
            ? "命运分歧生成中..."
            : decision
              ? "重新生成命运分歧"
              : "开启命运分歧"}
        </button>
      </div>

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
                    ? "border-[var(--gold)] bg-[rgba(255,244,220,0.9)] shadow-sm"
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
                      {option.id}. {option.label}
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
              {isSaving ? "正在写入..." : "做出选择"}
            </button>
          </div>
          {hasSavedDecision ? (
            <div className="choice-result-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <BookBadge tone="success">命运已写入故事</BookBadge>
                  <h4 className="mt-3 font-serif text-xl font-black text-[var(--ink)]">
                    你选择了
                  </h4>
                  <p className="mt-2 text-sm font-bold leading-7 text-[var(--ink-soft)]">
                    {selectedChoiceLabel}
                  </p>
                </div>
                <a className="button-primary min-h-10 px-4 text-sm" href="#chapter-reader">
                  沿这条命运继续下一章
                </a>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                下一章将沿着这条命运继续。角色关系和故事状态已更新。
              </p>
              <div className="mt-4 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.7)] px-3 py-3">
                <p className="text-xs font-black text-[var(--gold-strong)]">主要影响摘要</p>
                <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--ink-soft)]">
                  {primaryImpactSummary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <ChapterStateChangesPanel stateChanges={stateChanges} />
          <InteractiveStateAfterSave interactiveState={interactiveState} />
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-[rgba(255,248,234,0.68)] p-4 text-sm leading-7 text-[var(--muted)]">
          还没有命运分歧。读完正文后点击“开启命运分歧”，会出现 A/B/C 三个方向，也可以写下自定义命运。
        </div>
      )}
    </PaperPanel>
  );
}
