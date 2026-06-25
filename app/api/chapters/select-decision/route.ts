import { NextResponse } from "next/server";
import { requestHasInternalSession } from "@/lib/internal/auth";
import {
  getInternalProjectBundle,
  saveInternalChapterUpdates,
  updateInternalProjectConfig,
} from "@/lib/internal/store";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import {
  CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT,
  normalizeChapterDecision,
  type ChapterDecisionOptionId,
} from "@/prompts/chapter-decision";
import { normalizeChapterOutlines } from "@/prompts/outline";
import {
  applyStoryStateChanges,
  buildStoryStateChanges,
  normalizeInteractiveStoryState,
} from "@/prompts/story-state";
import type { NextRequest } from "next/server";

type SelectDecisionBody = {
  projectId?: unknown;
  chapterId?: unknown;
  optionId?: unknown;
  customChoice?: unknown;
  user_id?: unknown;
};

type StaleChapterResult = {
  count: number;
  chapterNumbers: number[];
  staleAt: string;
};

const STALE_REASON_INTERACTIVE_DECISION_SELECTED = "decision-changed";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markRouteMetadataStale(
  route: Record<string, unknown>,
  staleFromChapterNumber: number,
  staleAt: string,
) {
  return {
    ...route,
    needsRegeneration: true,
    staleReason: STALE_REASON_INTERACTIVE_DECISION_SELECTED,
    staleFromChapterNumber,
    staleAt,
  };
}

function buildStaleChapterContent(
  content: unknown,
  staleFromChapterNumber: number,
  staleAt: string,
) {
  if (!isRecord(content)) {
    return null;
  }

  const routeMetadata = isRecord(content.routeMetadata) ? content.routeMetadata : null;
  const legacyRoute = isRecord(content.route) ? content.route : null;
  const hasOldRouteContent = Boolean(
    content.draft ||
      content.official ||
      content.summary ||
      content.decision ||
      content.decisionGeneration ||
      content.stateChanges ||
      content.readBilling ||
      routeMetadata ||
      legacyRoute,
  );

  if (!hasOldRouteContent) {
    return null;
  }

  const nextContent: Record<string, unknown> = {
    ...content,
    needsRegeneration: true,
    stale: true,
    staleReason: STALE_REASON_INTERACTIVE_DECISION_SELECTED,
    staleFromChapterNumber,
    staleAt,
    routeMetadata: markRouteMetadataStale(
      routeMetadata ?? { generationSource: "reader-preload-10" },
      staleFromChapterNumber,
      staleAt,
    ),
    ...(legacyRoute
      ? {
          route: markRouteMetadataStale(legacyRoute, staleFromChapterNumber, staleAt),
        }
      : {}),
  };

  delete nextContent.draft;
  delete nextContent.official;
  delete nextContent.summary;
  delete nextContent.decision;
  delete nextContent.decisionGeneration;
  delete nextContent.stateChanges;
  delete nextContent.readBilling;

  return nextContent;
}

export async function POST(request: NextRequest) {
  if (!requestHasInternalSession(request)) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SelectDecisionBody | null;

  if (!body || typeof body !== "object") {
    return validationError("Invalid request body.");
  }

  if ("user_id" in body) {
    return validationError("select-decision does not accept user_id.");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId.trim() : "";
  const customChoice = cleanText(body.customChoice, CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT);

  if (!projectId || !chapterId) {
    return validationError("Missing project or chapter.");
  }

  if (
    typeof body.customChoice === "string" &&
    body.customChoice.trim().length > CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT
  ) {
    return validationError(`Custom choice cannot exceed ${CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT} characters.`);
  }

  const bundle = await getInternalProjectBundle(projectId);
  const config = bundle?.config ?? null;

  if (!bundle || !config || getProjectModeFromConfig(config.config_json) !== "interactive") {
    return validationError("Only interactive projects can save chapter decisions.");
  }

  const chapterRow = bundle.chapters.find((chapter) => chapter.id === chapterId) ?? null;
  const chapter = chapterRow ? normalizeChapterOutlines([chapterRow.content])[0] ?? null : null;

  if (!chapterRow || !chapter) {
    return validationError("Missing chapter outline.");
  }

  const decision = normalizeChapterDecision(
    isRecord(chapterRow.content)
      ? (chapterRow.content as { decision?: unknown }).decision
      : null,
  );

  if (!decision) {
    return validationError("Current chapter has no decision to save.");
  }

  if (!optionId && !customChoice) {
    return validationError("Select an option or enter a custom choice.");
  }

  const selectedOptionId = optionId || null;

  if (
    selectedOptionId &&
    !decision.options.some((option) => option.id === selectedOptionId)
  ) {
    return validationError("Decision option does not exist.");
  }

  const selectedDecision = {
    ...decision,
    selectedOptionId: selectedOptionId as ChapterDecisionOptionId | null,
    customChoice,
    selectedAt: new Date().toISOString(),
  };
  const stateChanges = buildStoryStateChanges(selectedDecision);
  const configJson = isRecord(config.config_json) ? config.config_json : {};
  const interactiveState = applyStoryStateChanges(
    configJson.interactiveState,
    stateChanges,
  );
  const chapterContent = {
    ...(isRecord(chapterRow.content) ? chapterRow.content : {}),
    ...chapter,
    decision: selectedDecision,
    stateChanges,
  };
  const staleAt = selectedDecision.selectedAt;
  const staleChapters: StaleChapterResult = {
    count: 0,
    chapterNumbers: [],
    staleAt,
  };
  const staleUpdates: Array<{ chapterId: string; content: Record<string, unknown> }> = [];

  for (const futureChapter of bundle.chapters
    .filter((item) => item.chapter_number > chapter.chapterNumber)
    .sort((left, right) => left.chapter_number - right.chapter_number)) {
    const staleContent = buildStaleChapterContent(
      futureChapter.content,
      chapter.chapterNumber,
      staleAt,
    );

    if (!staleContent) {
      continue;
    }

    staleUpdates.push({ chapterId: futureChapter.id, content: staleContent });
    staleChapters.count += 1;
    staleChapters.chapterNumbers.push(futureChapter.chapter_number);
  }

  await updateInternalProjectConfig(projectId, {
    ...configJson,
    interactiveState: normalizeInteractiveStoryState(interactiveState),
  });
  await saveInternalChapterUpdates(projectId, [
    { chapterId: chapterRow.id, content: chapterContent },
    ...staleUpdates,
  ]);

  return NextResponse.json({
    chapterId: chapterRow.id,
    decision: selectedDecision,
    stateChanges,
    interactiveState,
    staleChapters,
  });
}
