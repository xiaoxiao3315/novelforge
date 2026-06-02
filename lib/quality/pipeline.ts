import type {
  ChapterPlanInput,
  ChapterCritiqueInput,
  ChapterQualityCritique,
  ChapterQualityPromptContext,
  ChapterRewriteInput,
  ChapterWritingPlan,
} from "@/lib/quality/types";
import {
  normalizeChapterQualityCritique,
  normalizeChapterWritingPlan,
} from "@/lib/quality/validators";
import { CHAPTER_PLAN_PROMPT_VERSION } from "@/prompts/chapter-plan";
import { CHAPTER_CRITIQUE_PROMPT_VERSION } from "@/prompts/chapter-critique";
import { CHAPTER_REWRITE_PROMPT_VERSION } from "@/prompts/chapter-rewrite";

export const CHAPTER_QUALITY_PIPELINE_MODE = "quality-v1";
export const DEFAULT_REWRITE_SCORE_THRESHOLD = 82;

export type ChapterQualityDraftSource = "generate" | "existing";
export type ChapterQualityRewritePolicy = "always" | "score-threshold" | "never";
export type ChapterQualityPipelineStep = "plan" | "draft" | "critique" | "rewrite";
export type ChapterQualityPipelineStepStatus = "skipped" | "success" | "failed";
export type ChapterQualityPipelineStatus = "success" | "failed";

export type ChapterQualityDraftInput = {
  storyContext: ChapterQualityPromptContext;
  chapterPlan?: ChapterWritingPlan | null;
};

export type QualityPipelineModel = {
  generatePlan?(input: ChapterPlanInput): Promise<unknown>;
  generateDraft(input: ChapterQualityDraftInput): Promise<string>;
  generateCritique(input: ChapterCritiqueInput): Promise<unknown>;
  generateRewrite(input: ChapterRewriteInput): Promise<string>;
};

export type ChapterQualityPipelineInput = {
  storyContext: ChapterQualityPromptContext;
  draftSource?: ChapterQualityDraftSource;
  existingDraft?: string;
  rewritePolicy?: ChapterQualityRewritePolicy;
  rewriteScoreThreshold?: number;
  enablePlanning?: boolean;
};

export type ChapterQualityPipelineResult = {
  status: ChapterQualityPipelineStatus;
  plan?: ChapterWritingPlan;
  draft?: string;
  critique?: ChapterQualityCritique;
  rewrittenDraft?: string;
  finalText?: string;
  steps: Record<ChapterQualityPipelineStep, ChapterQualityPipelineStepStatus>;
  errors: Array<{
    step: ChapterQualityPipelineStep;
    message: string;
  }>;
  metadata: {
    promptVersions: {
      plan?: string;
      critique: string;
      rewrite: string;
    };
    mode: typeof CHAPTER_QUALITY_PIPELINE_MODE;
    createdAt: string;
    draftSource: ChapterQualityDraftSource;
    rewritePolicy: ChapterQualityRewritePolicy;
    rewriteScoreThreshold: number;
  };
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function cleanDraft(value: string) {
  return value.trim();
}

function createInitialResult({
  draftSource,
  rewritePolicy,
  rewriteScoreThreshold,
  enablePlanning,
}: {
  draftSource: ChapterQualityDraftSource;
  rewritePolicy: ChapterQualityRewritePolicy;
  rewriteScoreThreshold: number;
  enablePlanning: boolean;
}): ChapterQualityPipelineResult {
  return {
    status: "failed",
    steps: {
      plan: "skipped",
      draft: "skipped",
      critique: "skipped",
      rewrite: "skipped",
    },
    errors: [],
    metadata: {
      promptVersions: {
        ...(enablePlanning ? { plan: CHAPTER_PLAN_PROMPT_VERSION } : {}),
        critique: CHAPTER_CRITIQUE_PROMPT_VERSION,
        rewrite: CHAPTER_REWRITE_PROMPT_VERSION,
      },
      mode: CHAPTER_QUALITY_PIPELINE_MODE,
      createdAt: new Date().toISOString(),
      draftSource,
      rewritePolicy,
      rewriteScoreThreshold,
    },
  };
}

function shouldRewrite({
  critique,
  rewritePolicy,
  rewriteScoreThreshold,
}: {
  critique: ChapterQualityCritique;
  rewritePolicy: ChapterQualityRewritePolicy;
  rewriteScoreThreshold: number;
}) {
  if (rewritePolicy === "always") {
    return true;
  }

  if (rewritePolicy === "never") {
    return false;
  }

  return critique.overallScore < rewriteScoreThreshold;
}

export async function runChapterQualityPipeline(
  input: ChapterQualityPipelineInput,
  model: QualityPipelineModel,
): Promise<ChapterQualityPipelineResult> {
  const draftSource = input.draftSource ?? "generate";
  const rewritePolicy = input.rewritePolicy ?? "score-threshold";
  const rewriteScoreThreshold =
    typeof input.rewriteScoreThreshold === "number"
      ? input.rewriteScoreThreshold
      : DEFAULT_REWRITE_SCORE_THRESHOLD;
  const enablePlanning = input.enablePlanning ?? false;
  const result = createInitialResult({
    draftSource,
    rewritePolicy,
    rewriteScoreThreshold,
    enablePlanning,
  });

  let chapterPlan: ChapterWritingPlan | null = null;

  if (enablePlanning) {
    if (!model.generatePlan) {
      result.steps.plan = "failed";
      result.errors.push({
        step: "plan",
        message: "generatePlan callback is required when planning is enabled.",
      });
      return result;
    }

    try {
      const planOutput = await model.generatePlan({ storyContext: input.storyContext });
      const normalizedPlan = normalizeChapterWritingPlan(planOutput);

      if (!normalizedPlan) {
        result.steps.plan = "failed";
        result.errors.push({
          step: "plan",
          message: "chapter plan output failed validation.",
        });
        return result;
      }

      chapterPlan = normalizedPlan;
      result.plan = normalizedPlan;
      result.steps.plan = "success";
    } catch (error) {
      result.steps.plan = "failed";
      result.errors.push({ step: "plan", message: getErrorMessage(error) });
      return result;
    }
  }

  const storyContext = chapterPlan
    ? {
        ...input.storyContext,
        chapterPlan,
      }
    : input.storyContext;

  let draft = "";

  if (draftSource === "existing") {
    draft = cleanDraft(input.existingDraft ?? "");

    if (!draft) {
      result.steps.draft = "failed";
      result.errors.push({
        step: "draft",
        message: "existing draft is required when draftSource is existing.",
      });
      return result;
    }

    result.steps.draft = "success";
    result.draft = draft;
  } else {
    try {
      draft = cleanDraft(
        await model.generateDraft({
          storyContext,
          chapterPlan,
        }),
      );
    } catch (error) {
      result.steps.draft = "failed";
      result.errors.push({ step: "draft", message: getErrorMessage(error) });
      return result;
    }

    if (!draft) {
      result.steps.draft = "failed";
      result.errors.push({ step: "draft", message: "draft output is empty." });
      return result;
    }

    result.steps.draft = "success";
    result.draft = draft;
  }

  let critique: ChapterQualityCritique;

  try {
    const critiqueOutput = await model.generateCritique({
      draft,
      storyContext,
    });
    const normalizedCritique = normalizeChapterQualityCritique(critiqueOutput);

    if (!normalizedCritique) {
      result.steps.critique = "failed";
      result.errors.push({
        step: "critique",
        message: "critique output failed validation.",
      });
      return result;
    }

    critique = normalizedCritique;
  } catch (error) {
    result.steps.critique = "failed";
    result.errors.push({ step: "critique", message: getErrorMessage(error) });
    return result;
  }

  result.steps.critique = "success";
  result.critique = critique;

  if (!shouldRewrite({ critique, rewritePolicy, rewriteScoreThreshold })) {
    result.steps.rewrite = "skipped";
    result.finalText = draft;
    result.status = "success";
    return result;
  }

  try {
    const rewrittenDraft = cleanDraft(
      await model.generateRewrite({
        originalDraft: draft,
        critique,
        storyContext,
      }),
    );

    if (!rewrittenDraft) {
      result.steps.rewrite = "failed";
      result.errors.push({ step: "rewrite", message: "rewrite output is empty." });
      return result;
    }

    result.steps.rewrite = "success";
    result.rewrittenDraft = rewrittenDraft;
    result.finalText = rewrittenDraft;
    result.status = "success";
    return result;
  } catch (error) {
    result.steps.rewrite = "failed";
    result.errors.push({ step: "rewrite", message: getErrorMessage(error) });
    return result;
  }
}
