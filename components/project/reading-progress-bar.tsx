"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./reading-progress-bar.module.css";

/**
 * Fixed top reading-progress indicator plus a back-to-top affordance.
 *
 * - Renders a 3px bar pinned to the top of the viewport whose horizontal
 *   scale reflects the current vertical scroll percentage of the page.
 * - Reveals a circular "回到顶部" button once the page is scrolled past one
 *   viewport height.
 *
 * It is a global, position:fixed client component (no props). Mount it once
 * inside the reading view — e.g. within `ProjectReaderShellLayout` or at the
 * root of the reading page. SSR-safe: first paint shows 0% progress and the
 * button hidden; every `window` access is guarded and lives inside effects.
 *
 * Colors are driven entirely by the global theme variables (`--gold-strong`,
 * `--line`, `--paper`, ...) so the light / eye-care / night themes adapt
 * automatically. In immersive mode (`html[data-focus-mode="on"]`) the bar
 * intentionally keeps showing — progress is exactly what a reader wants — and
 * the button needs no special handling.
 */
export function ReadingProgressBar() {
  // Scroll progress in the [0, 1] range; drives the bar's scaleX.
  const [progress, setProgress] = useState(0);
  // Whether the page has been scrolled past one viewport height.
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frame = 0;

    const compute = () => {
      frame = 0;
      const { scrollY, innerHeight } = window;
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollable = scrollHeight - innerHeight;
      const ratio = scrollable > 0 ? scrollY / scrollable : 0;
      // Clamp against sub-pixel rounding / elastic overscroll.
      setProgress(ratio < 0 ? 0 : ratio > 1 ? 1 : ratio);
      setShowBackToTop(scrollY > innerHeight);
    };

    const onScroll = () => {
      // rAF-throttle: coalesce bursts of scroll events into one paint-aligned
      // measurement. setState inside this event callback is fine under React
      // 19's set-state-in-effect rule (only synchronous effect-body cascades
      // are flagged).
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(compute);
    };

    // Seed initial values (handles reloads at a non-zero scroll offset).
    compute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const handleBackToTop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, []);

  return (
    <>
      <div className={styles.track} aria-hidden="true">
        <div
          className={styles.bar}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <button
        type="button"
        aria-label="回到顶部"
        className={`${styles.backToTop} ${showBackToTop ? styles.backToTopVisible : ""}`}
        onClick={handleBackToTop}
        // Keep it out of the tab order while hidden so it can't be focused
        // behind the scenes; restored once visible.
        tabIndex={showBackToTop ? 0 : -1}
      >
        <span className={styles.backToTopGlyph} aria-hidden="true">
          ↑
        </span>
      </button>
    </>
  );
}
