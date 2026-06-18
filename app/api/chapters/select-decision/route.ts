import { NextResponse } from "next/server";
import { hasInternalSession } from "@/lib/internal/auth";
import {
  getInternalProjectBundle,
  saveInternalChapterUpdates,
  updateInternalProjectConfig,
} from "@/lib/internal/store";
import { getProjectModeFromConfig } from "@/lib/projects/modes";
import { createClient } from "@/lib/supabase/server";
import {
  CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT,
  normalizeChapterDecision,
  type ChapterDecisionOptionId,
} from "@/prompts/chapter-decision";
import { normalizeChapterOutlines, type ChapterOutline } from "@/prompts/outline";
import {
  applyStoryStateChanges,
  buildStoryStateChanges,
  normalizeInteractiveStoryState,
} from "@/prompts/story-state";

type SelectDecisionBody = {
  projectId?: unknown;
  chapterId?: unknown;
  optionId?: unknown;
  customChoice?: unknown;
  user_id?: unknown;
};

type StoryConfigRow = {
  config_json: unknown;
};

type ChapterRow = {
  id: string;
  content: unknown;
  chapter_number: number;
  title: string;
  event: string;
  conflict: string;
  character_change: string;
  highlight: string;
  foreshadowing: string;
  ending_hook: string;
  estimated_words: number;
};

type FutureChapterRow = {
  id: string;
  content: unknown;
  chapter_number: number;
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

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
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

function buildChapterOutline(row: ChapterRow): ChapterOutline | null {
  return (
    normalizeChapterOutlines([
      {
        chapterNumber: row.chapter_number,
        title: row.title,
        event: row.event,
        conflict: row.conflict,
        characterChange: row.character_change,
        highlight: row.highlight,
        foreshadowing: row.foreshadowing,
        endingHook: row.ending_hook,
        estimatedWords: row.estimated_words,
      },
    ])[0] ?? null
  );
}

export async function POST(request: Request) {
  if (await hasInternalSession()) {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SelectDecisionBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("保存剧情选择时不能从前端传 user_id。");
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const chapterId = typeof body.chapterId === "string" ? body.chapterId.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId.trim() : "";
  const customChoice = cleanText(body.customChoice, CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT);

  if (!projectId || !chapterId) {
    return validationError("缺少 project 或 chapter。");
  }

  if (
    typeof body.customChoice === "string" &&
    body.customChoice.trim().length > CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT
  ) {
    return validationError(`自定义选择不能超过 ${CHAPTER_DECISION_CUSTOM_CHOICE_LIMIT} 字。`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!project) {
    return validationError("缺少 project。");
  }

  const { data: config } = await supabase
    .from("story_configs")
    .select("config_json")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<StoryConfigRow>();

  if (!config || getProjectModeFromConfig(config.config_json) !== "interactive") {
    return validationError("只有互动剧情模式项目可以保存剧情选择。");
  }

  const { data: chapterRow, error: chapterError } = await supabase
    .from("chapters")
    .select(
      "id,content,chapter_number,title,event,conflict,character_change,highlight,foreshadowing,ending_hook,estimated_words",
    )
    .eq("project_id", projectId)
    .eq("id", chapterId)
    .maybeSingle<ChapterRow>();

  if (chapterError) {
    return serverError(chapterError.message);
  }

  const chapter = chapterRow ? buildChapterOutline(chapterRow) : null;

  if (!chapterRow || !chapter) {
    return validationError("缺少 chapter outline。");
  }

  const decision = normalizeChapterDecision(
    typeof chapterRow.content === "object" && chapterRow.content
      ? (chapterRow.content as { decision?: unknown }).decision
      : null,
  );

  if (!decision) {
    return validationError("当前章节还没有可保存的剧情选择。");
  }

  if (!optionId && !customChoice) {
    return validationError("请选择一个选项，或填写自定义选择。");
  }

  const selectedOptionId = optionId || null;

  if (
    selectedOptionId &&
    !decision.options.some((option) => option.id === selectedOptionId)
  ) {
    return validationError("选择项不存在。");
  }

  const selectedDecision = {
    ...decision,
    selectedOptionId: selectedOptionId as ChapterDecisionOptionId | null,
    customChoice,
    selectedAt: new Date().toISOString(),
  };
  const stateChanges = buildStoryStateChanges(selectedDecision);
  const interactiveState = applyStoryStateChanges(
    isRecord(config.config_json)
      ? (config.config_json as { interactiveState?: unknown }).interactiveState
      : null,
    stateChanges,
  );
  const chapterContent = {
    ...(typeof chapterRow.content === "object" && chapterRow.content ? chapterRow.content : {}),
    ...chapter,
    decision: selectedDecision,
    stateChanges,
  };
  const staleAt = selectedDecision.selectedAt;
  const { data: futureChapterRows, error: futureChaptersError } = await supabase
    .from("chapters")
    .select("id,content,chapter_number")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .gt("chapter_number", chapter.chapterNumber)
    .order("chapter_number", { ascending: true })
    .returns<FutureChapterRow[]>();

  if (futureChaptersError) {
    return serverError(futureChaptersError.message);
  }

  const staleChapters: StaleChapterResult = {
    count: 0,
    chapterNumbers: [],
    staleAt,
  };
  const staleUpdates: Array<{ id: string; content: Record<string, unknown> }> = [];

  for (const futureChapter of futureChapterRows ?? []) {
    const staleContent = buildStaleChapterContent(
      futureChapter.content,
      chapter.chapterNumber,
      staleAt,
    );

    if (!staleContent) {
      continue;
    }

    staleUpdates.push({ id: futureChapter.id, content: staleContent });
    staleChapters.count += 1;
    staleChapters.chapterNumbers.push(futureChapter.chapter_number);
  }

  // 单个事务内完成：保存本章选择、更新互动状态、标记后续章节需重生（见 wo017 RPC）。
  const configJson = isRecord(config.config_json) ? config.config_json : {};
  const { error: applyError } = await supabase.rpc("apply_chapter_decision", {
    p_project_id: project.id,
    p_chapter_id: chapterRow.id,
    p_chapter_content: chapterContent,
    p_config_json: {
      ...configJson,
      interactiveState: normalizeInteractiveStoryState(interactiveState),
    },
    p_stale_chapters: staleUpdates,
  });

  if (applyError) {
    return serverError(applyError.message || "剧情选择保存失败。");
  }

  const { error: logError } = await supabase.from("generation_logs").insert({
    project_id: project.id,
    operation: "select_decision_state_change",
    target_type: "chapter",
    target_id: chapterRow.id,
    prompt_version: "story-state-rules-v1",
    input: {
      chapterId: chapterRow.id,
      decision: selectedDecision,
      previousInteractiveState: normalizeInteractiveStoryState(
        isRecord(config.config_json)
          ? (config.config_json as { interactiveState?: unknown }).interactiveState
          : null,
      ),
    },
    output: {
      stateChanges,
      interactiveState,
      staleChapters,
    },
  });

  if (logError) {
    return serverError(logError.message);
  }

  return NextResponse.json({
    chapterId: chapterRow.id,
    decision: selectedDecision,
    stateChanges,
    interactiveState,
    staleChapters,
  });
}
