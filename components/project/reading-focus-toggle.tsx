"use client";

import { useSyncExternalStore } from "react";

type FocusMode = "on" | "off";

const FOCUS_KEY = "nf-focus-mode";

function isFocusMode(value: string | null): value is FocusMode {
  return value === "on" || value === "off";
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

function getFocusSnapshot(): FocusMode {
  const stored = window.localStorage.getItem(FOCUS_KEY);
  return isFocusMode(stored) ? stored : "off";
}

// 服务端渲染时的默认值（与下面的内联脚本默认一致）。
const serverFocus = (): FocusMode => "off";

function applyFocusMode(mode: FocusMode) {
  const root = document.documentElement;
  if (mode === "on") {
    root.setAttribute("data-focus-mode", "on");
  } else {
    root.removeAttribute("data-focus-mode");
  }
}

// 首屏前在 <html> 上设置 data-focus-mode，避免沉浸模式样式闪烁。
// 主控可将此常量接进 layout 的 <script dangerouslySetInnerHTML>。
export const FOCUS_MODE_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("${FOCUS_KEY}");if(m==="on"){document.documentElement.setAttribute("data-focus-mode","on")}else{document.documentElement.removeAttribute("data-focus-mode")}}catch(e){}})();`;

export function ReadingFocusToggle() {
  const mode = useSyncExternalStore(subscribe, getFocusSnapshot, serverFocus);
  const isOn = mode === "on";

  function toggle() {
    const next: FocusMode = isOn ? "off" : "on";
    applyFocusMode(next);
    window.localStorage.setItem(FOCUS_KEY, next);
    emit();
  }

  return (
    <div className="reading-focus-toggle">
      <button
        type="button"
        className="reading-focus-toggle-button"
        aria-pressed={isOn}
        data-active={isOn}
        onClick={toggle}
      >
        {isOn ? "退出沉浸" : "沉浸阅读"}
      </button>
    </div>
  );
}
