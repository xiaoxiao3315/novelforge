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

type SelectFieldProps = {
  name: string;
  label: string;
  options: PlotFilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type SectionProps = {
  title: string;
  children: ReactNode;
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

function Section({ title, children }: SectionProps) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-4 block font-serif text-xl font-black text-[var(--ink)]">
        {title}
      </legend>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function SelectField({ name, label, options, value, onChange }: SelectFieldProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <label className="block">
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
      <div className="grid gap-7 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-bold text-[var(--ink)]">作品名</span>
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
          <span className="mb-2 block text-sm font-bold text-[var(--ink)]">一句话简介</span>
          <input
            className="input"
            maxLength={200}
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="先用一句话记录你想写的故事方向"
          />
        </label>

        <Section title="基础方向">
          <fieldset className="md:col-span-2">
            <legend className="mb-3 block text-sm font-bold text-[var(--ink)]">项目模式</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {PROJECT_MODE_OPTIONS.map((option) => (
                <label
                  className={`rounded-md border px-4 py-4 transition ${
                    form.mode === option.value
                      ? "border-[var(--accent)] bg-[#eef4f2]"
                      : "border-[var(--line)] bg-white"
                  }`}
                  key={option.value}
                >
                  <span className="flex items-start gap-3">
                    <input
                      checked={form.mode === option.value}
                      className="mt-1"
                      name="projectMode"
                      onChange={() => updateField("mode", option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <span className="block font-black text-[var(--ink)]">{option.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                        {option.description}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <SelectField
            label="读者频道"
            name="channel"
            options={marketFilters.channels}
            value={form.channel}
            onChange={updateChannel}
          />
          <SelectField
            label="市场大类"
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
          <SelectField
            label="节奏基调"
            name="tone"
            options={marketFilters.tones}
            value={form.tone}
            onChange={(value) => updateField("tone", value)}
          />
        </Section>

        <Section title="市场卖点">
          <fieldset className="md:col-span-2">
            <legend className="mb-2 block text-sm font-bold text-[var(--ink)]">
              热门元素
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
              {marketFilters.tropes.map((option) => {
                const checked = form.tropes.includes(option.value);
                const disabled = !checked && form.tropes.length >= TROPE_LIMIT;

                return (
                  <label
                    className={`rounded-md border px-3 py-3 text-sm transition ${
                      checked
                        ? "border-[var(--accent)] bg-[#eef4f2]"
                        : "border-[var(--line)] bg-white"
                    } ${disabled ? "opacity-55" : ""}`}
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
            label="主角人设"
            name="protagonistArchetype"
            options={marketFilters.protagonistArchetypes}
            value={form.protagonistArchetype}
            onChange={(value) => updateField("protagonistArchetype", value)}
          />
          <SelectField
            label="金手指"
            name="cheatPower"
            options={marketFilters.cheatPowers}
            value={form.cheatPower}
            onChange={(value) => updateField("cheatPower", value)}
          />
          <SelectField
            label="情感线"
            name="romanceLine"
            options={marketFilters.romanceLines}
            value={form.romanceLine}
            onChange={(value) => updateField("romanceLine", value)}
          />
        </Section>

        <Section title="高级控制">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-bold text-[var(--ink)]">补充想法</span>
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

      {error ? (
        <p className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-3 py-2 text-sm text-[#7f2f1d]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          创建时只保存剧情筛选器，不触发 AI 生成，也不消耗点数。
        </p>
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "创建中..." : "创建作品"}
        </button>
      </div>
    </form>
  );
}
