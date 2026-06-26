"use client";

import { useEffect } from "react";

function buildStorageKey(projectId: string, chapterNumber: number) {
  return `nf-read-pos-${projectId}-${chapterNumber}`;
}

/**
 * Persists the reader's window scroll position per chapter and restores it when
 * the same chapter is reopened. Keyed by `nf-read-pos-<projectId>-<chapterNumber>`.
 * Renders nothing; mount it once inside the reading view for the active chapter.
 */
export function ReadingScrollMemory({
  chapterNumber,
  projectId,
}: {
  chapterNumber: number;
  projectId: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = buildStorageKey(projectId, chapterNumber);

    const persist = () => {
      try {
        window.localStorage.setItem(storageKey, String(Math.round(window.scrollY)));
      } catch {
        // Storage may be unavailable (private mode, quota); ignore.
      }
    };

    // Restore after layout/paint so the saved offset actually exists. A saved
    // position takes precedence over the default `#chapter-reader` hash anchor.
    let restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = window.requestAnimationFrame(() => {
        try {
          const saved = window.localStorage.getItem(storageKey);
          if (!saved) {
            return;
          }
          const top = Number.parseInt(saved, 10);
          if (Number.isFinite(top) && top > 0) {
            window.scrollTo({ behavior: "auto", top });
          }
        } catch {
          // ignore storage errors
        }
      });
    });

    let saveTimer = 0;
    const onScroll = () => {
      if (saveTimer) {
        return;
      }
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        persist();
      }, 250);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", persist);

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", persist);
      persist();
    };
  }, [chapterNumber, projectId]);

  return null;
}
