"use client";

import { useEffect, useState } from "react";

type GenerationProgressProps = {
  /** 是否正在生成 */
  active: boolean;
  /** 预估总耗时（秒），用于软进度条逼近速度。默认 40 秒。 */
  estimatedSeconds?: number;
  /** 轮播的阶段文案；不传则用通用文案。 */
  stages?: string[];
};

const DEFAULT_STAGES = [
  "正在理解设定与前情……",
  "正在构思情节走向……",
  "正在落笔生成内容……",
  "正在润色与收尾……",
];

/**
 * 生成等待反馈：软进度条（随时间逼近但不虚假到 100%）+ 阶段文案轮播 + 已用时。
 * 用于非流式生成（作品设定 / 故事圣经 / 章节大纲），缓解几十秒黑盒等待的焦虑。
 */
export function GenerationProgress({
  active,
  estimatedSeconds = 40,
  stages = DEFAULT_STAGES,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const start = Date.now();
    // 首帧用计时器异步更新，避免在 effect 体内同步 setState 触发级联渲染。
    const timer = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);

    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [active]);

  if (!active) {
    return null;
  }

  // 软进度：用指数逼近，永远到不了 100%（避免“卡在 100%”的尴尬），
  // 在预估时间点约到 85%，之后缓慢爬升。
  const progress = Math.min(95, 100 * (1 - Math.exp(-elapsed / (estimatedSeconds * 0.55))));
  const stageIndex = Math.min(
    stages.length - 1,
    Math.floor((progress / 100) * stages.length),
  );
  const overEstimate = elapsed > estimatedSeconds * 1.5;

  return (
    <div className="mt-5 rounded-md border border-[var(--line)] bg-[rgba(255,248,234,0.72)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--ink)]">{stages[stageIndex]}</p>
        <span className="shrink-0 text-xs font-bold text-[var(--muted)]">
          {elapsed.toFixed(0)}s
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(138,58,33,0.12)]">
        <div
          className="h-full rounded-full bg-[var(--gold-strong)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {overEstimate
          ? "AI 仍在生成，复杂内容可能需要更久，请再稍候……"
          : "AI 生成中，通常需要几十秒，请勿关闭页面。"}
      </p>
    </div>
  );
}
