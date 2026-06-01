"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { plotFilters, type PlotFilterOption } from "@/data/plot-filters";
import {
  DEFAULT_PROJECT_MODE,
  PROJECT_MODE_OPTIONS,
  type ProjectMode,
} from "@/lib/projects/modes";
import { formatUserFacingError } from "@/lib/ui/errors";

type SelectFieldProps = {
  name: string;
  label: string;
  options: PlotFilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type FormState = {
  title: string;
  description: string;
  theme: string;
  genre: string;
  background: string;
  worldSetting: string;
  protagonist: string;
  coreConflict: string;
  tone: string;
  serialStructure: string;
  extraIdeas: string;
  mode: ProjectMode;
};

const initialState: FormState = {
  title: "",
  description: "",
  theme: plotFilters.themes[0]?.value || "",
  genre: plotFilters.genres[0]?.value || "",
  background: plotFilters.backgrounds[0]?.value || "",
  worldSetting: plotFilters.worldSettings[0]?.value || "",
  protagonist: plotFilters.protagonists[0]?.value || "",
  coreConflict: plotFilters.coreConflicts[0]?.value || "",
  tone: plotFilters.tones[0]?.value || "",
  serialStructure: plotFilters.serialStructures[0]?.value || "",
  extraIdeas: "",
  mode: DEFAULT_PROJECT_MODE,
};

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

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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
        theme: form.theme,
        genre: form.genre,
        background: form.background,
        worldSetting: form.worldSetting,
        protagonist: form.protagonist,
        coreConflict: form.coreConflict,
        tone: form.tone,
        serialStructure: form.serialStructure,
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
      <div className="grid gap-5 md:grid-cols-2">
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

        <SelectField
          label="主题"
          name="theme"
          options={plotFilters.themes}
          value={form.theme}
          onChange={(value) => updateField("theme", value)}
        />
        <SelectField
          label="类型"
          name="genre"
          options={plotFilters.genres}
          value={form.genre}
          onChange={(value) => updateField("genre", value)}
        />
        <SelectField
          label="背景"
          name="background"
          options={plotFilters.backgrounds}
          value={form.background}
          onChange={(value) => updateField("background", value)}
        />
        <SelectField
          label="世界设定"
          name="worldSetting"
          options={plotFilters.worldSettings}
          value={form.worldSetting}
          onChange={(value) => updateField("worldSetting", value)}
        />
        <SelectField
          label="主角"
          name="protagonist"
          options={plotFilters.protagonists}
          value={form.protagonist}
          onChange={(value) => updateField("protagonist", value)}
        />
        <SelectField
          label="核心冲突"
          name="coreConflict"
          options={plotFilters.coreConflicts}
          value={form.coreConflict}
          onChange={(value) => updateField("coreConflict", value)}
        />
        <SelectField
          label="基调"
          name="tone"
          options={plotFilters.tones}
          value={form.tone}
          onChange={(value) => updateField("tone", value)}
        />
        <SelectField
          label="连载结构"
          name="serialStructure"
          options={plotFilters.serialStructures}
          value={form.serialStructure}
          onChange={(value) => updateField("serialStructure", value)}
        />

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
