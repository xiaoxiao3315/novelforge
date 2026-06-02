import { NextResponse } from "next/server";
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
    .eq("user_id", user.id)
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
  const { data: savedChapter, error: updateError } = await supabase
    .from("chapters")
    .update({ content: chapterContent })
    .eq("id", chapterRow.id)
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (updateError || !savedChapter) {
    return serverError(updateError?.message || "剧情选择保存失败。");
  }

  const configJson = isRecord(config.config_json) ? config.config_json : {};
  const { error: configUpdateError } = await supabase
    .from("story_configs")
    .update({
      config_json: {
        ...configJson,
        interactiveState: normalizeInteractiveStoryState(interactiveState),
      },
    })
    .eq("project_id", project.id)
    .eq("user_id", user.id);

  if (configUpdateError) {
    return serverError(configUpdateError.message);
  }

  await supabase.from("generation_logs").insert({
    project_id: project.id,
    operation: "select_decision_state_change",
    target_type: "chapter",
    target_id: savedChapter.id,
    prompt_version: "story-state-rules-v1",
    input: {
      chapterId: savedChapter.id,
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
    },
  });

  return NextResponse.json({
    chapterId: savedChapter.id,
    decision: selectedDecision,
    stateChanges,
    interactiveState,
  });
}
