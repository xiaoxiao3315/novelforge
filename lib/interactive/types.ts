export type RouteAccent = "amber" | "teal" | "violet" | "rose";

export type ImpactKind = "relationship" | "route" | "meter" | "flag" | "clue";

export type TimelineStatus = "past" | "current" | "possible" | "locked";

export type InteractiveChapter = {
  id: string;
  volumeTitle: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  readTimeMinutes: number;
  body: string[];
  endingBeat: string;
};

export type StoryImpact = {
  kind: ImpactKind;
  target: string;
  delta?: number;
  note: string;
};

export type DecisionOption = {
  id: "A" | "B" | "C";
  label: string;
  description: string;
  routeHint: string;
  effects: StoryImpact[];
};

export type ChapterDecision = {
  id: string;
  question: string;
  options: DecisionOption[];
};

export type CharacterRelationship = {
  character: string;
  role: string;
  affinity: number;
  trust: number;
  status: string;
  recentChange: string;
};

export type StoryMeter = {
  label: string;
  value: number;
  description: string;
};

export type RouteTendency = {
  id: string;
  label: string;
  score: number;
  trend: number;
  accent: RouteAccent;
  description: string;
};

export type StoryRouteEvent = {
  id: string;
  chapterLabel: string;
  title: string;
  summary: string;
  status: TimelineStatus;
  route: string;
  choice?: string;
  consequences: string[];
};

export type InteractiveStoryPrototype = {
  title: string;
  premise: string;
  currentChapter: InteractiveChapter;
  chapterDecision: ChapterDecision;
  selectedOptionId: DecisionOption["id"];
  relationships: CharacterRelationship[];
  meters: StoryMeter[];
  routeTendencies: RouteTendency[];
  routeTimeline: StoryRouteEvent[];
  flags: string[];
  clues: string[];
};
