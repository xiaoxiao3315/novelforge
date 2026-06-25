"use client";

import { useState } from "react";

type GenerationErrorProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  detail?: string;
};

/**
 * 统一的生成失败提示：友好文案 + 一键重试 + 可展开的原始原因。
 * 替代各生成组件里重复的单行红字，降低失败时的挫败感。
 */
export function GenerationError({
  message,
  onRetry,
  retrying = false,
  retryLabel = "重试",
  detail,
}: GenerationErrorProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      className="mt-5 rounded-md border border-[#e2b6a6] bg-[#fff4ef] px-4 py-3 text-sm text-[#7f2f1d]"
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="leading-6">{message}</p>
        {onRetry ? (
          <button
            className="shrink-0 rounded-md border border-[#c97a63] bg-white px-3 py-1 text-xs font-bold text-[#7f2f1d] transition hover:bg-[#fdeee8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={retrying}
            onClick={onRetry}
            type="button"
          >
            {retrying ? "重试中..." : retryLabel}
          </button>
        ) : null}
      </div>

      {detail && detail !== message ? (
        <div className="mt-2">
          <button
            className="text-xs font-bold underline decoration-dotted underline-offset-2"
            onClick={() => setShowDetail((value) => !value)}
            type="button"
          >
            {showDetail ? "收起原因" : "查看失败原因"}
          </button>
          {showDetail ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#e2b6a6] bg-white/70 px-3 py-2 text-xs leading-5 text-[#7f2f1d]">
              {detail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
