"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMarketGenresForChannel,
  getSubGenresForMarketGenre,
  marketFilters,
  type PlotFilterOption,
} from "@/data/plot-filters";
import {
  DEFAULT_PROJECT_MODE,
  PROJECT_MODE_OPTIONS,
  type ProjectMode,
} from "@/lib/projects/modes";
import { formatUserFacingError } from "@/lib/ui/errors";

const TROPE_LIMIT = 3;

const MODE_ENTRY_COPY: Record<
  ProjectMode,
  {
    description: string;
    hint?: string;
    title: string;
  }
> = {
  classic: {
    title: "经典小说模式",
    description: "适合稳定连载，生成设定、大纲和章节正文。",
  },
  interactive: {
    title: "互动剧情模式",
    description: "适合读完章节后做选择，故事会记住你的决定。",
    hint: "推荐：想做 Galgame / 底特律轻量体验时选择。",
  },
};

type SelectFieldProps = {
  className?: string;
  name: string;
  label: string;
  options: PlotFilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type SectionProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  title: string;
};

type FormState = {
  title: string;
  description: string;
  channel: string;
  marketGenre: string;
  subGenre: string;
  tropes: string[];
  protagonistArchetype: string;
  cheatPower: string;
  romanceLine: string;
  tone: string;
  extraIdeas: string;
  mode: ProjectMode;
};

const initialChannel = marketFilters.channels[0]?.value || "";
const initialMarketGenre = getMarketGenresForChannel(initialChannel)[0]?.value || "";
const initialSubGenre = getSubGenresForMarketGenre(initialMarketGenre)[0]?.value || "";

const initialState: FormState = {
  title: "",
  description: "",
  channel: initialChannel,
  marketGenre: initialMarketGenre,
  subGenre: initialSubGenre,
  tropes: [],
  protagonistArchetype: marketFilters.protagonistArchetypes[0]?.value || "",
  cheatPower: marketFilters.cheatPowers[0]?.value || "",
  romanceLine: marketFilters.romanceLines[0]?.value || "",
  tone: marketFilters.tones[0]?.value || "",
  extraIdeas: "",
  mode: DEFAULT_PROJECT_MODE,
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function findOptionLabel(options: PlotFilterOption[], value: string, fallback = "等待选择") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function Section({ children, className, description, title }: SectionProps) {
  return (
    <fieldset className={classes("border-t border-[var(--line)] pt-6", className)}>
      <legend className="block font-serif text-xl font-black text-[var(--ink)]">
        {title}
      </legend>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function SelectField({ className, name, label, options, value, onChange }: SelectFieldProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <label className={classes("block", className)}>
      <span className="mb-2 block text-sm font-bold text-[var(--ink)]">{label}</span>
      <select
        className="input"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block min-h-10 text-xs leading-5 text-[var(--muted)]">
        {selected?.description}
      </span>
    </label>
  );
}

function PreviewItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.68)] px-3 py-3">
      <p className="text-xs font-black text-[var(--accent-strong)]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-[var(--ink)]">{value}</p>
    </div>
  );
}

function StoryPreviewCard({
  form,
  marketGenreOptions,
  subGenreOptions,
}: {
  form: FormState;
  marketGenreOptions: PlotFilterOption[];
  subGenreOptions: PlotFilterOption[];
}) {
  const title = form.title.trim() || "未命名的新故事";
  const description = form.description.trim();
  const modeCopy = MODE_ENTRY_COPY[form.mode];
  const selectedTropes = form.tropes
    .map((value) => findOptionLabel(marketFilters.tropes, value, ""))
    .filter(Boolean);
  const hookText = selectedTropes.length
    ? selectedTropes.join("、")
    : findOptionLabel(marketFilters.cheatPowers, form.cheatPower);

  return (
    <aside
      aria-label="故事预览"
      className="rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] p-5 lg:sticky lg:top-6 lg:self-start"
    >
      <p className="text-xs font-black uppercase tracking-wide text-[var(--accent-strong)]">
        故事预览
      </p>
      <h2 className="mt-2 font-serif text-2xl font-black text-[var(--ink)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description || "先写下一句话，让这个世界有一个清晰的入口。"}
      </p>

      <div className="mt-5 grid gap-3">
        <PreviewItem label="故事形态" value={modeCopy.title} />
        <PreviewItem
          label="类型"
          value={`${findOptionLabel(marketGenreOptions, form.marketGenre)} / ${findOptionLabel(
            subGenreOptions,
            form.subGenre,
          )}`}
        />
        <PreviewItem
          label="主角设定"
          value={findOptionLabel(marketFilters.protagonistArchetypes, form.protagonistArchetype)}
        />
        <PreviewItem label="核心爽点" value={hookText} />
        <PreviewItem label="情绪基调" value={findOptionLabel(marketFilters.tones, form.tone)} />
      </div>

      <p className="mt-4 rounded-md border border-dashed border-[var(--line)] px-3 py-3 text-xs leading-5 text-[var(--muted)]">
        开启后会带着这些选择进入项目页；正文生成和创作额度消耗都在项目页再开始。
      </p>
    </aside>
  );
}

export function CreateProjectForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const marketGenreOptions = useMemo(
    () => getMarketGenresForChannel(form.channel),
    [form.channel],
  );
  const subGenreOptions = useMemo(
    () => getSubGenresForMarketGenre(form.marketGenre),
    [form.marketGenre],
  );
  const submitLabel = form.mode === "interactive" ? "开启这段命运" : "创建这本小说";

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateChannel(channel: string) {
    const nextMarketGenre = getMarketGenresForChannel(channel)[0]?.value || "";
    const nextSubGenre = getSubGenresForMarketGenre(nextMarketGenre)[0]?.value || "";

    setForm((current) => ({
      ...current,
      channel,
      marketGenre: nextMarketGenre,
      subGenre: nextSubGenre,
    }));
  }

  function updateMarketGenre(marketGenre: string) {
    const nextSubGenre = getSubGenresForMarketGenre(marketGenre)[0]?.value || "";

    setForm((current) => ({
      ...current,
      marketGenre,
      subGenre: nextSubGenre,
    }));
  }

  function toggleTrope(value: string) {
    setForm((current) => {
      if (current.tropes.includes(value)) {
        return {
          ...current,
          tropes: current.tropes.filter((item) => item !== value),
        };
      }

      if (current.tropes.length >= TROPE_LIMIT) {
        return current;
      }

      return {
        ...current,
        tropes: [...current.tropes, value],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        channel: form.channel,
        marketGenre: form.marketGenre,
        subGenre: form.subGenre,
        tropes: form.tropes,
        protagonistArchetype: form.protagonistArchetype,
        cheatPower: form.cheatPower,
        romanceLine: form.romanceLine,
        tone: form.tone,
        extraIdeas: form.extraIdeas,
        mode: form.mode,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { projectId?: string; error?: string }
      | null;

    setIsSubmitting(false);

    if (!response.ok || !payload?.projectId) {
      setError(formatUserFacingError(payload?.error, "作品创建失败，请稍后重试。"));
      return;
    }

    router.replace(`/project/${payload.projectId}`);
    router.refresh();
  }

  return (
    <form className="surface p-6" onSubmit={handleSubmit}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-7">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[var(--ink)]">故事名</span>
              <input
                className="input"
                maxLength={80}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="例如：雾城契约"
                required
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[var(--ink)]">
                一句话开启这个世界
              </span>
              <input
                className="input"
                maxLength={200}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="写下主角、世界或第一个冲突，让故事先亮起来"
              />
            </label>
          </div>

          <Section
            title="先选一条命运的起点"
            description="选择故事的创作方式。之后的设定、大纲、章节和互动选择都会沿着这里展开。"
          >
            <fieldset className="md:col-span-2">
              <legend className="sr-only">故事模式</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {PROJECT_MODE_OPTIONS.map((option) => {
                  const modeCopy = MODE_ENTRY_COPY[option.value];
                  const selected = form.mode === option.value;

                  return (
                    <label
                      className={classes(
                        "rounded-md border px-4 py-4 transition",
                        selected
                          ? "border-[var(--accent)] bg-[#eef4f2]"
                          : "border-[var(--line)] bg-white",
                      )}
                      key={option.value}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          checked={selected}
                          className="mt-1"
                          name="projectMode"
                          onChange={() => updateField("mode", option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span className="min-w-0">
                          <span className="block font-black text-[var(--ink)]">
                            {modeCopy.title}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                            {modeCopy.description}
                          </span>
                          {modeCopy.hint ? (
                            <span className="mt-2 block rounded-sm bg-[rgba(255,248,234,0.82)] px-2 py-1 text-xs font-bold leading-5 text-[var(--accent-strong)]">
                              {modeCopy.hint}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Section>

          <Section title="故事给谁看" description="先确定读者入口，让故事的爽点和节奏有落点。">
            <SelectField
              className="md:col-span-2"
              label="读者频道"
              name="channel"
              options={marketFilters.channels}
              value={form.channel}
              onChange={updateChannel}
            />
          </Section>

          <Section title="故事类型" description="选择题材大方向和细分赛道，让世界观先有形状。">
            <SelectField
              label="题材大方向"
              name="marketGenre"
              options={marketGenreOptions}
              value={form.marketGenre}
              onChange={updateMarketGenre}
            />
            <SelectField
              label="细分赛道"
              name="subGenre"
              options={subGenreOptions}
              value={form.subGenre}
              onChange={(value) => updateField("subGenre", value)}
            />
          </Section>

          <Section title="爽点与钩子" description="最多挑三个最想兑现的阅读快感，再补上核心能力。">
            <fieldset className="md:col-span-2">
              <legend className="mb-2 block text-sm font-bold text-[var(--ink)]">
                核心爽点
              </legend>
              <div className="grid gap-3 md:grid-cols-3">
                {marketFilters.tropes.map((option) => {
                  const checked = form.tropes.includes(option.value);
                  const disabled = !checked && form.tropes.length >= TROPE_LIMIT;

                  return (
                    <label
                      className={classes(
                        "rounded-md border px-3 py-3 text-sm transition",
                        checked
                          ? "border-[var(--accent)] bg-[#eef4f2]"
                          : "border-[var(--line)] bg-white",
                        disabled && "opacity-55",
                      )}
                      key={option.value}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          checked={checked}
                          className="mt-1"
                          disabled={disabled}
                          onChange={() => toggleTrope(option.value)}
                          type="checkbox"
                        />
                        <span>
                          <span className="block font-bold text-[var(--ink)]">{option.label}</span>
                          <span className="mt-1 block leading-5 text-[var(--muted)]">
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                已选择 {form.tropes.length}/{TROPE_LIMIT}
              </p>
            </fieldset>

            <SelectField
              className="md:col-span-2"
              label="核心能力或反转"
              name="cheatPower"
              options={marketFilters.cheatPowers}
              value={form.cheatPower}
              onChange={(value) => updateField("cheatPower", value)}
            />
          </Section>

          <Section title="主角与关系" description="定下故事中心的人，以及关系线会怎样牵动读者。">
            <SelectField
              label="主角设定"
              name="protagonistArchetype"
              options={marketFilters.protagonistArchetypes}
              value={form.protagonistArchetype}
              onChange={(value) => updateField("protagonistArchetype", value)}
            />
            <SelectField
              label="关系走向"
              name="romanceLine"
              options={marketFilters.romanceLines}
              value={form.romanceLine}
              onChange={(value) => updateField("romanceLine", value)}
            />
          </Section>

          <Section title="阅读情绪" description="给这本书一个稳定的体感，后续章节会沿着它发力。">
            <SelectField
              className="md:col-span-2"
              label="情绪基调"
              name="tone"
              options={marketFilters.tones}
              value={form.tone}
              onChange={(value) => updateField("tone", value)}
            />
          </Section>

          <Section title="补充灵感" description="把你已经想到的人物、禁忌、场景或特别想保留的火花写下来。">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[var(--ink)]">灵感手记</span>
              <textarea
                className="input min-h-32 resize-y py-3 leading-6"
                maxLength={1200}
                value={form.extraIdeas}
                onChange={(event) => updateField("extraIdeas", event.target.value)}
                placeholder="写下你已有的人物、场景、禁忌、爽点或不想写的方向。"
              />
            </label>
          </Section>
        </div>

        <StoryPreviewCard
          form={form}
          marketGenreOptions={marketGenreOptions}
          subGenreOptions={subGenreOptions}
        />
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
        <p className="text-sm leading-6 text-[var(--muted)]">
          开启故事只保存市场筛选器和模式，不触发 AI 生成，也不消耗创作额度。
        </p>
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "正在开启故事世界..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
