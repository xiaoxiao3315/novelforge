export type ProjectMode = "classic" | "interactive";

export const DEFAULT_PROJECT_MODE: ProjectMode = "classic";

export const PROJECT_MODE_OPTIONS: Array<{
  value: ProjectMode;
  label: string;
  description: string;
}> = [
  {
    value: "classic",
    label: "经典小说模式",
    description: "按现有流程生成设定、故事圣经、章节大纲和单章正文。",
  },
  {
    value: "interactive",
    label: "互动剧情模式",
    description: "作为独立产品分支预留，后续支持章节选择、状态变化和路线图。",
  },
];

export const PROJECT_MODE_LABELS: Record<ProjectMode, string> = Object.fromEntries(
  PROJECT_MODE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ProjectMode, string>;

export function isProjectMode(value: unknown): value is ProjectMode {
  return value === "classic" || value === "interactive";
}

export function normalizeProjectMode(value: unknown): ProjectMode {
  return isProjectMode(value) ? value : DEFAULT_PROJECT_MODE;
}

export function getProjectModeFromConfig(configJson: unknown): ProjectMode {
  if (!configJson || typeof configJson !== "object") {
    return DEFAULT_PROJECT_MODE;
  }

  return normalizeProjectMode((configJson as { mode?: unknown }).mode);
}
