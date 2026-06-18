"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENERATION_CREDIT_COSTS } from "@/lib/credits";
import { formatUserFacingError } from "@/lib/ui/errors";

type ClaimReadResponse = {
  error?: string;
};

type ClaimState = "confirm" | "claiming" | "insufficient" | "error";

function dispatchReaderPreloadPause(paused: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("novelforge:reader-preload-pause", {
      detail: { paused, reason: "claim-read" },
    }),
  );
}

export function ChapterReadClaimGate({
  autoClaim = true,
  chapterId,
  chapterNumber,
  projectId,
}: {
  autoClaim?: boolean;
  chapterId: string;
  chapterNumber: number;
  projectId: string;
}) {
  const claimCost = GENERATION_CREDIT_COSTS.claim_read_chapter;
  const [claimState, setClaimState] = useState<ClaimState>(
    autoClaim ? "claiming" : "confirm",
  );
  const [message, setMessage] = useState(
    autoClaim
      ? "正在打开章节..."
      : `第 ${chapterNumber} 章已缓存完成，解锁后即可继续阅读。`,
  );
  const [attempt, setAttempt] = useState(0);
  const didStartRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (claimState !== "claiming" || didStartRef.current) {
      return;
    }

    didStartRef.current = true;

    async function claimRead() {
      dispatchReaderPreloadPause(true);

      try {
        const response = await fetch("/api/chapters/claim-read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            chapterId,
          }),
        });
        const payload = (await response.json().catch(() => null)) as ClaimReadResponse | null;

        if (response.ok) {
          router.refresh();
          return;
        }

        if (response.status === 402) {
          setClaimState("insufficient");
          setMessage("星火不足，无法继续阅读");
          return;
        }

        setClaimState("error");
        setMessage(formatUserFacingError(payload?.error, "章节打开失败，请稍后重试。"));
      } catch {
        setClaimState("error");
        setMessage("网络异常，章节打开失败，请检查网络后重试。");
      } finally {
        dispatchReaderPreloadPause(false);
      }
    }

    void claimRead();
  }, [attempt, chapterId, claimState, projectId, router]);

  function startClaim(nextMessage: string) {
    didStartRef.current = false;
    setMessage(nextMessage);
    setAttempt((currentAttempt) => currentAttempt + 1);
    setClaimState("claiming");
  }

  return (
    <div className="reader-claim-gate">
      <p>{message}</p>
      {claimState === "confirm" ? (
        <button
          className="button-primary min-h-10 px-4 text-sm"
          onClick={() => startClaim("正在打开章节...")}
          type="button"
        >
          消耗 {claimCost} 星火解锁本章
        </button>
      ) : null}
      {claimState === "insufficient" ? (
        <Link className="button-primary min-h-10 px-4 text-sm" href="/account/credits">
          补充星火
        </Link>
      ) : null}
      {claimState === "error" ? (
        <button
          className="button-secondary min-h-10 px-4 text-sm"
          onClick={() => startClaim("正在打开章节...")}
          type="button"
        >
          重新打开
        </button>
      ) : null}
    </div>
  );
}
