"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "sepia" | "dark";
type FontScale = "0.9" | "1" | "1.15" | "1.3";

const THEME_KEY = "nf-theme";
const FONT_KEY = "nf-reader-font-scale";

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "光" },
  { id: "sepia", label: "护眼" },
  { id: "dark", label: "夜间" },
];

const FONT_SCALES: { id: FontScale; label: string }[] = [
  { id: "0.9", label: "小" },
  { id: "1", label: "中" },
  { id: "1.15", label: "大" },
  { id: "1.3", label: "特大" },
];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "sepia" || value === "dark";
}

function isFontScale(value: string | null): value is FontScale {
  return value === "0.9" || value === "1" || value === "1.15" || value === "1.3";
}

// 用一个轻量的外部 store 订阅 localStorage 变化，避免在 effect 里同步 setState
// 触发级联渲染（React 19 / react-hooks/set-state-in-effect 规则）。
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY);
  return isTheme(stored) ? stored : "light";
}

function getFontSnapshot(): FontScale {
  const stored = window.localStorage.getItem(FONT_KEY);
  return isFontScale(stored) ? stored : "1";
}

// 服务端渲染时的默认值（与 layout 内联脚本的默认一致）。
const serverTheme = (): Theme => "light";
const serverFont = (): FontScale => "1";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function applyFontScale(scale: FontScale) {
  document.documentElement.style.setProperty("--reader-font-scale", scale);
}

export function ThemeController() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, serverTheme);
  const fontScale = useSyncExternalStore(subscribe, getFontSnapshot, serverFont);

  function handleTheme(next: Theme) {
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    emit();
  }

  function handleFont(next: FontScale) {
    applyFontScale(next);
    window.localStorage.setItem(FONT_KEY, next);
    emit();
  }

  return (
    <div className="theme-controller">
      <div className="theme-controller-group" role="group" aria-label="阅读主题">
        {THEMES.map((option) => (
          <button
            key={option.id}
            type="button"
            className="theme-controller-button"
            aria-pressed={theme === option.id}
            data-active={theme === option.id}
            onClick={() => handleTheme(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="theme-controller-group" role="group" aria-label="正文字号">
        {FONT_SCALES.map((option) => (
          <button
            key={option.id}
            type="button"
            className="theme-controller-button"
            aria-pressed={fontScale === option.id}
            data-active={fontScale === option.id}
            onClick={() => handleFont(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
