export const CHAPTER_QUALITY_SCORE_KEYS = [
  "pacing",
  "conflict",
  "emotion",
  "characterConsistency",
  "worldConsistency",
  "proseQuality",
  "hookStrength",
  "commercialAppeal",
] as const;

export type ChapterQualityScoreKey = (typeof CHAPTER_QUALITY_SCORE_KEYS)[number];

export type ChapterQualityScores = Record<ChapterQualityScoreKey, number>;

export type ChapterQualityCritique = {
  scores: ChapterQualityScores;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  revisionDirectives: string[];
  continuityRisks: string[];
  mustKeep: string[];
  mustFix: string[];
};

export type ChapterQualityMode = "standard" | "quality";

export type ChapterWritingPlan = {
  chapterGoal: string;
  coreConflict: string;
  emotionalArc: string;
  keyScenes: string[];
  characterBeats: Array<{
    character: string;
    goal: string;
    emotionalChange: string;
    dialogueTone: string;
  }>;
  suspenseAndHooks: string[];
  mustInclude: string[];
  mustAvoid: string[];
  pacingPlan: string[];
  endingHook: string;
  continuityNotes: string[];
};

export type ChapterQualityPromptContext = {
  storyConfig: unknown;
  storyConcept: unknown;
  storyBible: unknown;
  characters: unknown[];
  volume: unknown;
  chapterOutline: unknown;
  previousSummaries: unknown[];
  directorInstruction?: unknown;
  interactiveDecision?: unknown;
  interactiveState?: unknown;
  chapterPlan?: ChapterWritingPlan | null;
};

export type ChapterPlanInput = {
  storyContext: ChapterQualityPromptContext;
};

export type ChapterCritiqueInput = {
  draft: string;
  storyContext: ChapterQualityPromptContext;
};

export type ChapterRewriteInput = {
  originalDraft: string;
  critique: ChapterQualityCritique;
  storyContext: ChapterQualityPromptContext;
};

export type ChapterQualityPipelineMetadata = {
  mode: ChapterQualityMode;
  pipelineVersion: string;
  critique?: ChapterQualityCritique;
  finalSource: "draft" | "rewrite";
};
