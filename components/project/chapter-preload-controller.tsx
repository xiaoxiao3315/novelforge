"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterContent } from "@/prompts/chapter";

type PreloadChapter = ChapterContent & {
  id?: string;
  needsRegeneration?: boolean;
  stale?: boolean;
};

type ChapterPreloadControllerProps = {
  anchorChapterNumber: number;
  chapters: PreloadChapter[];
  projectId: string;
};

type ReaderPreloadStatus =
  | "idle"
  | "waiting"
  | "running"
  | "cooldown"
  | "retrying"
  | "paused"
  | "generated"
  | "failed"
  | "complete";

type ReaderPreloadStatusDetail = {
  anchorChapterNumber: number;
  attempt?: number;
  currentChapterNumber?: number;
  error?: string;
  failedChapterNumber?: number;
  generatedChapterNumbers: number[];
  generatedCount: number;
  nextDelayMs?: number;
  maxAttempts?: number;
  projectId: string;
  reason?: string;
  status: ReaderPreloadStatus;
  targetChapterNumbers: number[];
  totalTargetCount: number;
};

type PreloadRequestResult =
  | { ok: true }
  | {
      error?: string;
      ok: false;
      status?: number;
    };

const PRELOAD_COOLDOWN_MS = 12_000;
const PRELOAD_INITIAL_DELAY_MS = 8_000;
const PRELOAD_LOCK_TTL_MS = 120_000;
const PRELOAD_MAX_ATTEMPTS = 3;
const PRELOAD_RETRY_BASE_DELAY_MS = 5_000;

function hasReadableBody(chapter: PreloadChapter) {
  return Boolean(
    !chapter.needsRegeneration &&
      !chapter.stale &&
      (chapter.official?.body || chapter.draft?.body),
  );
}

function shouldPreloadChapter(chapter: PreloadChapter) {
  if (!chapter.id) {
    return false;
  }

  if (chapter.readBilling) {
    return false;
  }

  return !hasReadableBody(chapter);
}

function dispatchReaderPreloadStatus(detail: ReaderPreloadStatusDetail) {
  window.dispatchEvent(
    new CustomEvent<ReaderPreloadStatusDetail>("novelforge:reader-preload-status", {
      detail,
    }),
  );
}

function describePreloadStatus(detail: ReaderPreloadStatusDetail) {
  switch (detail.status) {
    case "running":
      if (!detail.currentChapterNumber) {
        return "正在生成后续章节";
      }

      return detail.attempt && detail.attempt > 1
        ? `正在生成第 ${detail.currentChapterNumber} 章（第 ${detail.attempt} 次尝试）`
        : `正在生成第 ${detail.currentChapterNumber} 章`;
    case "retrying":
      return detail.currentChapterNumber
        ? `第 ${detail.currentChapterNumber} 章稍后重试`
        : "稍后重试";
    case "cooldown":
      return "冷却中，准备生成下一章";
    case "generated":
      return detail.currentChapterNumber
        ? `第 ${detail.currentChapterNumber} 章已缓存`
        : "已缓存一章";
    case "waiting":
      if (detail.reason === "another-tab-running") {
        return "其他页面正在缓存";
      }

      if (detail.reason === "page-hidden") {
        return "页面隐藏，已暂停缓存";
      }

      if (detail.reason === "offline") {
        return "网络离线，已暂停缓存";
      }

      return "等待空闲后开始缓存";
    case "paused":
      return "已暂停缓存";
    case "failed":
      return detail.failedChapterNumber
        ? `第 ${detail.failedChapterNumber} 章缓存失败`
        : "缓存失败";
    case "complete":
      return "后续章节已全部缓存";
    default:
      return "准备缓存后续章节";
  }
}

function createControllerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function delayPreload(ms: number, shouldCancel: () => boolean) {
  return new Promise<"cancelled" | "ready">((resolve) => {
    const timeoutId = window.setTimeout(() => {
      resolve(shouldCancel() ? "cancelled" : "ready");
    }, ms);

    if (shouldCancel()) {
      window.clearTimeout(timeoutId);
      resolve("cancelled");
    }
  });
}

function shouldRetryPreloadRequest(result: PreloadRequestResult) {
  if (result.ok) {
    return false;
  }

  if (!result.status) {
    return true;
  }

  return result.status === 408 || result.status === 429 || result.status >= 500;
}

function getPreloadRetryDelayMs(attempt: number) {
  return PRELOAD_RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0);
}

function getProjectLockKey(projectId: string) {
  return `novelforge:reader-preload-lock:${projectId}`;
}

function getLockStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readProjectLock(projectId: string) {
  const storage = getLockStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(getProjectLockKey(projectId));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { ownerId?: unknown; updatedAt?: unknown };

    if (typeof parsed.ownerId !== "string" || typeof parsed.updatedAt !== "number") {
      return null;
    }

    return parsed as { ownerId: string; updatedAt: number };
  } catch {
    return null;
  }
}

function acquireProjectLock(projectId: string, ownerId: string) {
  const storage = getLockStorage();

  if (!storage) {
    return true;
  }

  const lock = readProjectLock(projectId);
  const now = Date.now();

  if (lock && lock.ownerId !== ownerId && now - lock.updatedAt < PRELOAD_LOCK_TTL_MS) {
    return false;
  }

  storage.setItem(
    getProjectLockKey(projectId),
    JSON.stringify({
      ownerId,
      updatedAt: now,
    }),
  );

  return true;
}

function releaseProjectLock(projectId: string, ownerId: string) {
  const storage = getLockStorage();

  if (!storage) {
    return;
  }

  const lock = readProjectLock(projectId);

  if (lock?.ownerId === ownerId) {
    storage.removeItem(getProjectLockKey(projectId));
  }
}

async function requestPreloadChapter({
  anchorChapterNumber,
  chapter,
  projectId,
}: {
  anchorChapterNumber: number;
  chapter: PreloadChapter;
  projectId: string;
}): Promise<PreloadRequestResult> {
  try {
    const response = await fetch("/api/generate/chapter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        qualityMode: "normal",
        generationSource: "reader-preload-10",
        anchorChapterNumber,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (response.ok) {
      return { ok: true };
    }

    return {
      error: payload?.error || response.statusText || `HTTP ${response.status}`,
      ok: false,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "后台缓存请求失败。",
      ok: false,
    };
  }
}

export function ChapterPreloadController({
  anchorChapterNumber,
  chapters,
  projectId,
}: ChapterPreloadControllerProps) {
  const [pauseReasons, setPauseReasons] = useState<string[]>([]);
  const [isWindowReady, setIsWindowReady] = useState(true);
  const [statusDetail, setStatusDetail] = useState<ReaderPreloadStatusDetail | null>(null);
  const controllerIdRef = useRef(createControllerId());
  const isRunningRef = useRef(false);
  const router = useRouter();
  const isPaused = pauseReasons.length > 0;
  const candidateChapters = useMemo(
    () =>
      chapters
        .filter(
          (chapter) =>
            chapter.chapterNumber > anchorChapterNumber &&
            chapter.chapterNumber <= anchorChapterNumber + 10,
        )
        .sort((left, right) => left.chapterNumber - right.chapterNumber),
    [anchorChapterNumber, chapters],
  );
  const targetChapters = useMemo(
    () => candidateChapters.filter(shouldPreloadChapter),
    [candidateChapters],
  );
  const targetKey = targetChapters
    .map((chapter) => `${chapter.id ?? chapter.chapterNumber}:${chapter.chapterNumber}`)
    .join("|");
  const targetChapterNumbers = useMemo(
    () => candidateChapters.map((chapter) => chapter.chapterNumber),
    [candidateChapters],
  );

  const emitStatus = useCallback((
    status: ReaderPreloadStatus,
    overrides: Partial<ReaderPreloadStatusDetail> = {},
  ) => {
    const detail: ReaderPreloadStatusDetail = {
      anchorChapterNumber,
      generatedChapterNumbers: [],
      generatedCount: 0,
      projectId,
      status,
      targetChapterNumbers,
      totalTargetCount: targetChapterNumbers.length,
      ...overrides,
    };

    // setStatusDetail 通过 microtask 延迟，避免在 effect 同步路径里直接 setState
    // 触发级联渲染（react-hooks/set-state-in-effect）。microtask 在绘制前结算，行为不变。
    queueMicrotask(() => setStatusDetail(detail));
    dispatchReaderPreloadStatus(detail);
  }, [anchorChapterNumber, projectId, targetChapterNumbers]);

  useEffect(() => {
    function handlePause(event: Event) {
      const customEvent = event as CustomEvent<{ paused?: boolean; reason?: string }>;
      const reason = customEvent.detail?.reason || "external";

      setPauseReasons((currentReasons) => {
        const nextReasons = new Set(currentReasons);

        if (customEvent.detail?.paused) {
          nextReasons.add(reason);
        } else {
          nextReasons.delete(reason);
        }

        return [...nextReasons];
      });
    }

    window.addEventListener("novelforge:reader-preload-pause", handlePause);

    return () => {
      window.removeEventListener("novelforge:reader-preload-pause", handlePause);
    };
  }, []);

  useEffect(() => {
    function updateWindowReadiness() {
      setIsWindowReady(document.visibilityState === "visible" && navigator.onLine);
    }

    updateWindowReadiness();
    document.addEventListener("visibilitychange", updateWindowReadiness);
    window.addEventListener("online", updateWindowReadiness);
    window.addEventListener("offline", updateWindowReadiness);

    return () => {
      document.removeEventListener("visibilitychange", updateWindowReadiness);
      window.removeEventListener("online", updateWindowReadiness);
      window.removeEventListener("offline", updateWindowReadiness);
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      emitStatus("paused", { reason: pauseReasons.join(", ") || "external" });
      return;
    }

    if (!isWindowReady) {
      emitStatus("waiting", {
        reason:
          typeof document !== "undefined" && document.visibilityState !== "visible"
            ? "page-hidden"
            : "offline",
      });
      return;
    }

    if (targetChapters.length === 0) {
      emitStatus("complete");
      return;
    }

    if (isRunningRef.current) {
      return;
    }

    let isCancelled = false;

    async function runPreload() {
      isRunningRef.current = true;
      let generatedAny = false;
      let didFail = false;
      const generatedChapterNumbers: number[] = [];
      const controllerId = controllerIdRef.current;

      try {
        if (!acquireProjectLock(projectId, controllerId)) {
          emitStatus("waiting", {
            nextDelayMs: PRELOAD_INITIAL_DELAY_MS,
            reason: "another-tab-running",
          });
          return;
        }

        emitStatus("waiting", {
          nextDelayMs: PRELOAD_INITIAL_DELAY_MS,
          reason: "reader-idle-delay",
        });

        const initialDelayState = await delayPreload(
          PRELOAD_INITIAL_DELAY_MS,
          () => isCancelled || isPaused || !isWindowReady,
        );

        if (initialDelayState === "cancelled") {
          return;
        }

        for (const chapter of targetChapters) {
          if (isCancelled || isPaused) {
            break;
          }

          let result: PreloadRequestResult = { ok: false };

          for (let attempt = 1; attempt <= PRELOAD_MAX_ATTEMPTS; attempt += 1) {
            if (isCancelled || isPaused) {
              break;
            }

            emitStatus("running", {
              attempt,
              currentChapterNumber: chapter.chapterNumber,
              generatedChapterNumbers,
              generatedCount: generatedChapterNumbers.length,
              maxAttempts: PRELOAD_MAX_ATTEMPTS,
            });

            result = await requestPreloadChapter({
              anchorChapterNumber,
              chapter,
              projectId,
            });

            if (result.ok || !shouldRetryPreloadRequest(result) || attempt === PRELOAD_MAX_ATTEMPTS) {
              break;
            }

            const retryDelayMs = getPreloadRetryDelayMs(attempt);
            emitStatus("retrying", {
              attempt,
              currentChapterNumber: chapter.chapterNumber,
              error: result.error,
              generatedChapterNumbers,
              generatedCount: generatedChapterNumbers.length,
              maxAttempts: PRELOAD_MAX_ATTEMPTS,
              nextDelayMs: retryDelayMs,
            });

            const retryDelayState = await delayPreload(
              retryDelayMs,
              () => isCancelled || isPaused || !isWindowReady,
            );

            if (retryDelayState === "cancelled") {
              break;
            }
          }

          if (isCancelled || isPaused) {
            break;
          }

          if (!result.ok) {
            didFail = true;
            emitStatus("failed", {
              currentChapterNumber: chapter.chapterNumber,
              error: result.error,
              failedChapterNumber: chapter.chapterNumber,
              generatedChapterNumbers,
              generatedCount: generatedChapterNumbers.length,
            });
            break;
          }

          generatedAny = true;
          generatedChapterNumbers.push(chapter.chapterNumber);
          emitStatus("generated", {
            currentChapterNumber: chapter.chapterNumber,
            generatedChapterNumbers,
            generatedCount: generatedChapterNumbers.length,
          });

          if (chapter !== targetChapters[targetChapters.length - 1]) {
            emitStatus("cooldown", {
              currentChapterNumber: chapter.chapterNumber,
              generatedChapterNumbers,
              generatedCount: generatedChapterNumbers.length,
              nextDelayMs: PRELOAD_COOLDOWN_MS,
            });

            const cooldownState = await delayPreload(
              PRELOAD_COOLDOWN_MS,
              () => isCancelled || isPaused || !isWindowReady,
            );

            if (cooldownState === "cancelled") {
              break;
            }
          }
        }

        if (!didFail && !isCancelled && !isPaused) {
          emitStatus("complete", {
            generatedChapterNumbers,
            generatedCount: generatedChapterNumbers.length,
          });
        }
      } finally {
        isRunningRef.current = false;
        releaseProjectLock(projectId, controllerIdRef.current);

        if (generatedAny && !isCancelled) {
          router.refresh();
        }
      }
    }

    void runPreload();

    return () => {
      isCancelled = true;
    };
  }, [
    anchorChapterNumber,
    emitStatus,
    isPaused,
    isWindowReady,
    pauseReasons,
    projectId,
    router,
    targetChapters,
    targetKey,
  ]);

  if (!statusDetail) {
    return null;
  }

  const totalCount = statusDetail.totalTargetCount;

  if (totalCount === 0) {
    return null;
  }

  const isComplete = statusDetail.status === "complete";
  const isFailed = statusDetail.status === "failed";
  const completedCount = isComplete
    ? totalCount
    : Math.min(statusDetail.generatedCount, totalCount);
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const containerClassName = [
    "reader-batch-progress",
    isComplete ? "reader-batch-progress-success" : "",
    isFailed ? "reader-batch-progress-failed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName} role="status" aria-live="polite">
      <div className="reader-batch-progress-head">
        <span>后台缓存后续章节</span>
        <span>
          {completedCount}/{totalCount} 已完成
        </span>
      </div>
      <div
        className="reader-batch-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-valuenow={completedCount}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      <p>
        {describePreloadStatus(statusDetail)}
        {isFailed && statusDetail.error ? `：${statusDetail.error}` : ""}
      </p>
    </div>
  );
}
