import type {
  ChapterCharacterDirection,
  ChapterCharacterDirectionInput,
  ChapterFastGuidanceInput,
  ChapterPlanInput,
  ChapterCritiqueInput,
  ChapterQualityCritique,
  ChapterQualityPromptContext,
  ChapterRewriteInput,
  ChapterWritingPlan,
} from "@/lib/quality/types";
import {
  normalizeChapterFastGuidance,
  normalizeChapterCharacterDirection,
  normalizeChapterQualityCritique,
  normalizeChapterWritingPlan,
  validateChapterCharacterDirection,
} from "@/lib/quality/validators";
import { CHAPTER_CHARACTER_DIRECTION_PROMPT_VERSION } from "@/prompts/chapter-character-direction";
import { CHAPTER_FAST_GUIDANCE_PROMPT_VERSION } from "@/prompts/chapter-fast-guidance";
import { CHAPTER_PLAN_PROMPT_VERSION } from "@/prompts/chapter-plan";
import { CHAPTER_CRITIQUE_PROMPT_VERSION } from "@/prompts/chapter-critique";
import { CHAPTER_REWRITE_PROMPT_VERSION } from "@/prompts/chapter-rewrite";

export const CHAPTER_QUALITY_PIPELINE_MODE = "quality-v1";
export const DEFAULT_REWRITE_SCORE_THRESHOLD = 82;
export const DEFAULT_FAST_REWRITE_SCORE_THRESHOLD = 76;
export const DEFAULT_FAST_REWRITE_CRITICAL_SCORE_THRESHOLD = 72;

export type ChapterQualityDraftSource = "generate" | "existing";
export type ChapterQualityRewritePolicy = "always" | "score-threshold" | "never";
export type ChapterQualityPipelineStep =
  | "plan"
  | "characterDirection"
  | "draft"
  | "critique"
  | "rewrite";
export type ChapterQualityPipelineStepStatus = "skipped" | "success" | "failed";
export type ChapterQualityPipelineStatus = "success" | "failed";

export type ChapterQualityDraftInput = {
  storyContext: ChapterQualityPromptContext;
  chapterPlan?: ChapterWritingPlan | null;
  chapterCharacterDirection?: ChapterCharacterDirection | null;
};

export type QualityPipelineModel = {
  generateGuidance?(input: ChapterFastGuidanceInput): Promise<unknown>;
  generatePlan?(input: ChapterPlanInput): Promise<unknown>;
  generateCharacterDirection?(input: ChapterCharacterDirectionInput): Promise<unknown>;
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
  criticalRewriteScoreThreshold?: number;
  enablePlanning?: boolean;
  enableCharacterDirection?: boolean;
  enableFastGuidance?: boolean;
};

export type ChapterQualityPipelineResult = {
  status: ChapterQualityPipelineStatus;
  plan?: ChapterWritingPlan;
  characterDirection?: ChapterCharacterDirection;
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
      guidance?: string;
      plan?: string;
      characterDirection?: string;
      critique: string;
      rewrite: string;
    };
    mode: typeof CHAPTER_QUALITY_PIPELINE_MODE;
    createdAt: string;
    draftSource: ChapterQualityDraftSource;
    rewritePolicy: ChapterQualityRewritePolicy;
    rewriteScoreThreshold: number;
    criticalRewriteScoreThreshold: number;
    rewriteDecisionReason?: string;
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
  criticalRewriteScoreThreshold,
  enablePlanning,
  enableCharacterDirection,
  enableFastGuidance,
}: {
  draftSource: ChapterQualityDraftSource;
  rewritePolicy: ChapterQualityRewritePolicy;
  rewriteScoreThreshold: number;
  criticalRewriteScoreThreshold: number;
  enablePlanning: boolean;
  enableCharacterDirection: boolean;
  enableFastGuidance: boolean;
}): ChapterQualityPipelineResult {
  return {
    status: "failed",
    steps: {
      plan: "skipped",
      characterDirection: "skipped",
      draft: "skipped",
      critique: "skipped",
      rewrite: "skipped",
    },
    errors: [],
    metadata: {
      promptVersions: {
        ...(enableFastGuidance ? { guidance: CHAPTER_FAST_GUIDANCE_PROMPT_VERSION } : {}),
        ...(enablePlanning ? { plan: CHAPTER_PLAN_PROMPT_VERSION } : {}),
        ...(enableCharacterDirection
          ? { characterDirection: CHAPTER_CHARACTER_DIRECTION_PROMPT_VERSION }
          : {}),
        critique: CHAPTER_CRITIQUE_PROMPT_VERSION,
        rewrite: CHAPTER_REWRITE_PROMPT_VERSION,
      },
      mode: CHAPTER_QUALITY_PIPELINE_MODE,
      createdAt: new Date().toISOString(),
      draftSource,
      rewritePolicy,
      rewriteScoreThreshold,
      criticalRewriteScoreThreshold,
    },
  };
}

function getRewriteDecision({
  critique,
  rewritePolicy,
  rewriteScoreThreshold,
  criticalRewriteScoreThreshold,
}: {
  critique: ChapterQualityCritique;
  rewritePolicy: ChapterQualityRewritePolicy;
  rewriteScoreThreshold: number;
  criticalRewriteScoreThreshold: number;
}) {
  if (rewritePolicy === "always") {
    return { shouldRewrite: true, reason: "rewritePolicy=always" };
  }

  if (rewritePolicy === "never") {
    return { shouldRewrite: false, reason: "rewritePolicy=never" };
  }

  if (critique.overallScore < rewriteScoreThreshold) {
    return {
      shouldRewrite: true,
      reason: `overallScore ${critique.overallScore} < ${rewriteScoreThreshold}`,
    };
  }

  const criticalScores = [
    ["characterConsistency", critique.scores.characterConsistency],
    ["worldConsistency", critique.scores.worldConsistency],
    ["hookStrength", critique.scores.hookStrength],
  ] as const;
  const weakCriticalScore = criticalScores.find(([, score]) => score < criticalRewriteScoreThreshold);

  if (weakCriticalScore) {
    return {
      shouldRewrite: true,
      reason: `${weakCriticalScore[0]} ${weakCriticalScore[1]} < ${criticalRewriteScoreThreshold}`,
    };
  }

  return {
    shouldRewrite: false,
    reason: "draft score is acceptable for fast quality mode",
  };
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
  const criticalRewriteScoreThreshold =
    typeof input.criticalRewriteScoreThreshold === "number"
      ? input.criticalRewriteScoreThreshold
      : DEFAULT_FAST_REWRITE_CRITICAL_SCORE_THRESHOLD;
  const enableCharacterDirection = input.enableCharacterDirection ?? false;
  const enablePlanning = (input.enablePlanning ?? false) || enableCharacterDirection;
  const enableFastGuidance = input.enableFastGuidance ?? false;
  const result = createInitialResult({
    draftSource,
    rewritePolicy,
    rewriteScoreThreshold,
    criticalRewriteScoreThreshold,
    enablePlanning,
    enableCharacterDirection,
    enableFastGuidance,
  });

  let chapterPlan: ChapterWritingPlan | null = null;
  let chapterCharacterDirection: ChapterCharacterDirection | null =
    input.storyContext.chapterCharacterDirection ?? null;

  if (enableFastGuidance) {
    if (!model.generateGuidance) {
      result.steps.plan = "failed";
      result.steps.characterDirection = "failed";
      result.errors.push({
        step: "plan",
        message: "generateGuidance callback is required when fast guidance is enabled.",
      });
      return result;
    }

    try {
      const guidanceOutput = await model.generateGuidance({ storyContext: input.storyContext });
      const normalizedGuidance = normalizeChapterFastGuidance(guidanceOutput);

      if (!normalizedGuidance) {
        result.steps.plan = "failed";
        result.steps.characterDirection = "failed";
        result.errors.push({
          step: "plan",
          message: "fast guidance output failed validation.",
        });
        return result;
      }

      chapterPlan = normalizedGuidance.plan;
      chapterCharacterDirection = normalizedGuidance.characterDirection;
      result.plan = normalizedGuidance.plan;
      result.characterDirection = normalizedGuidance.characterDirection;
      result.steps.plan = "success";
      result.steps.characterDirection = "success";
    } catch (error) {
      result.steps.plan = "failed";
      result.steps.characterDirection = "failed";
      result.errors.push({ step: "plan", message: getErrorMessage(error) });
      return result;
    }
  } else if (enablePlanning) {
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

  const storyContextWithPlan = chapterPlan
    ? {
        ...input.storyContext,
        chapterPlan,
      }
    : input.storyContext;

  if (!enableFastGuidance && enableCharacterDirection) {
    if (!chapterPlan) {
      result.steps.characterDirection = "failed";
      result.errors.push({
        step: "characterDirection",
        message: "chapter plan is required before character direction.",
      });
      return result;
    }

    if (!model.generateCharacterDirection) {
      result.steps.characterDirection = "failed";
      result.errors.push({
        step: "characterDirection",
        message:
          "generateCharacterDirection callback is required when character direction is enabled.",
      });
      return result;
    }

    try {
      const directionOutput = await model.generateCharacterDirection({
        storyContext: storyContextWithPlan,
        chapterPlan,
      });
      const directionValidation = validateChapterCharacterDirection(directionOutput);
      const normalizedDirection = directionValidation.ok
        ? directionValidation.direction
        : normalizeChapterCharacterDirection(directionOutput);

      if (!normalizedDirection) {
        result.steps.characterDirection = "failed";
        result.errors.push({
          step: "characterDirection",
          message: directionValidation.ok
            ? "chapter character direction output failed validation."
            : `chapter character direction output failed validation: ${directionValidation.error}`,
        });
        return result;
      }

      chapterCharacterDirection = normalizedDirection;
      result.characterDirection = normalizedDirection;
      result.steps.characterDirection = "success";
    } catch (error) {
      result.steps.characterDirection = "failed";
      result.errors.push({
        step: "characterDirection",
        message: getErrorMessage(error),
      });
      return result;
    }
  }

  const storyContext = chapterCharacterDirection
    ? {
        ...storyContextWithPlan,
        chapterCharacterDirection,
      }
    : storyContextWithPlan;

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
          chapterCharacterDirection,
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

  const rewriteDecision = getRewriteDecision({
    critique,
    rewritePolicy,
    rewriteScoreThreshold,
    criticalRewriteScoreThreshold,
  });
  result.metadata.rewriteDecisionReason = rewriteDecision.reason;

  if (!rewriteDecision.shouldRewrite) {
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
      // 精修失败时回退保留初稿：初稿与审稿已完成，不应让整条流水线作废。
      result.finalText = draft;
      result.status = "success";
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
    // 精修失败时回退保留初稿：初稿与审稿已完成，不应让整条流水线作废。
    result.finalText = draft;
    result.status = "success";
    return result;
  }
}
