import {
  buildStoryConfigPromptLines,
  type StoryConfigPromptData,
} from "@/data/plot-filters";
import type { StoryConcept } from "@/prompts/concept";

export const BIBLE_PROMPT_VERSION = "bible-v1";

export type StoryBible = {
  worldview: string;
  powerSystem: string;
  majorFactions: string;
  mainPlot: string;
  firstVolumePlot: string;
  protagonistArc: string;
  antagonistPlan: string;
  midLateForeshadowing: string;
  finalTruth: string;
  immutableRules: string[];
};

export type CharacterCard = {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  goal: string;
  weakness: string;
  secret: string;
  relationshipToProtagonist: string;
  characterArc: string;
};

export type StoryBibleGeneration = {
  bible: StoryBible;
  characters: CharacterCard[];
};

export type BiblePromptInput = {
  project: {
    title: string;
    description: string | null;
  };
  config: StoryConfigPromptData;
  concept: StoryConcept;
};

const bibleTextFields = [
  "worldview",
  "powerSystem",
  "majorFactions",
  "mainPlot",
  "firstVolumePlot",
  "protagonistArc",
  "antagonistPlan",
  "midLateForeshadowing",
  "finalTruth",
] as const;

const bibleSchemaKeys = [...bibleTextFields, "immutableRules"] as const;
const bibleSchemaKeySet = new Set<string>(bibleSchemaKeys);

const characterTextFields = [
  "name",
  "role",
  "appearance",
  "personality",
  "goal",
  "weakness",
  "secret",
  "relationshipToProtagonist",
  "characterArc",
] as const;

const characterSchemaKeySet = new Set<string>(characterTextFields);

const bibleJsonStructureExample = JSON.stringify(
  {
    bible: {
      worldview: "世界观：时代、地域、社会结构和核心矛盾。",
      powerSystem: "核心规则 / 力量系统：能力来源、代价、限制和升级方式。",
      majorFactions: "主要组织 / 势力：至少三方势力及利益冲突。",
      mainPlot: "主线剧情：贯穿全书的目标、阻碍和阶段变化。",
      firstVolumePlot: "第一卷主线：起点、关键转折、卷末爆点。",
      protagonistArc: "主角成长线：能力、心态、关系和责任的变化。",
      antagonistPlan: "反派计划：短期动作、长期目的和隐藏动机。",
      midLateForeshadowing: "中后期伏笔：可在后续卷展开的线索。",
      finalTruth: "最终真相：世界、主角或核心冲突的终局揭示。",
      immutableRules: ["不可变规则一", "不可变规则二", "不可变规则三"],
    },
    characters: [
      {
        name: "角色名",
        role: "角色定位",
        appearance: "外貌特征",
        personality: "性格",
        goal: "目标",
        weakness: "弱点",
        secret: "秘密",
        relationshipToProtagonist: "与主角关系",
        characterArc: "成长线",
      },
    ],
  },
  null,
  2,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 1600) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  scope: string,
) {
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (extraKeys.length > 0) {
    return `${scope} 包含 schema 外字段：${extraKeys.join(", ")}。`;
  }

  return "";
}

export function normalizeStoryBible(value: unknown): StoryBible | null {
  if (!isRecord(value)) {
    return null;
  }

  const bible = {} as Record<(typeof bibleTextFields)[number], string>;

  for (const field of bibleTextFields) {
    const cleaned = cleanText(value[field]);

    if (!cleaned) {
      return null;
    }

    bible[field] = cleaned;
  }

  const immutableRulesValue = value.immutableRules;

  if (!Array.isArray(immutableRulesValue)) {
    return null;
  }

  const immutableRules = immutableRulesValue
    .map((item) => cleanText(item, 360))
    .filter(Boolean)
    .slice(0, 12);

  if (immutableRules.length === 0) {
    return null;
  }

  return {
    worldview: bible.worldview,
    powerSystem: bible.powerSystem,
    majorFactions: bible.majorFactions,
    mainPlot: bible.mainPlot,
    firstVolumePlot: bible.firstVolumePlot,
    protagonistArc: bible.protagonistArc,
    antagonistPlan: bible.antagonistPlan,
    midLateForeshadowing: bible.midLateForeshadowing,
    finalTruth: bible.finalTruth,
    immutableRules,
  };
}

export function normalizeCharacterCards(value: unknown): CharacterCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const character = {} as Record<(typeof characterTextFields)[number], string>;

      for (const field of characterTextFields) {
        const cleaned = cleanText(item[field]);

        if (!cleaned) {
          return null;
        }

        character[field] = cleaned;
      }

      return {
        name: character.name,
        role: character.role,
        appearance: character.appearance,
        personality: character.personality,
        goal: character.goal,
        weakness: character.weakness,
        secret: character.secret,
        relationshipToProtagonist: character.relationshipToProtagonist,
        characterArc: character.characterArc,
      };
    })
    .filter((item): item is CharacterCard => Boolean(item));
}

export function validateStoryBibleGenerationSchema(
  value: unknown,
):
  | { ok: true; bible: StoryBible; characters: CharacterCard[] }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "输出必须是 JSON object。" };
  }

  const topLevelError = validateExactKeys(value, new Set(["bible", "characters"]), "根对象");

  if (topLevelError) {
    return { ok: false, error: topLevelError };
  }

  const bibleValue = value.bible;

  if (!isRecord(bibleValue)) {
    return { ok: false, error: "bible 必须是 JSON object。" };
  }

  const bibleExtraKeyError = validateExactKeys(bibleValue, bibleSchemaKeySet, "bible");

  if (bibleExtraKeyError) {
    return { ok: false, error: bibleExtraKeyError };
  }

  const missingBibleKeys = bibleSchemaKeys.filter((key) => !(key in bibleValue));

  if (missingBibleKeys.length > 0) {
    return { ok: false, error: `bible 缺少字段：${missingBibleKeys.join(", ")}。` };
  }

  const bible = {} as Record<(typeof bibleTextFields)[number], string>;

  for (const field of bibleTextFields) {
    const rawValue = bibleValue[field];

    if (typeof rawValue !== "string") {
      return { ok: false, error: `bible.${field} 必须是字符串。` };
    }

    const cleaned = rawValue.trim();

    if (!cleaned) {
      return { ok: false, error: `bible.${field} 不能为空。` };
    }

    if (cleaned.length > 1600) {
      return { ok: false, error: `bible.${field} 超过 1600 字符。` };
    }

    bible[field] = cleaned;
  }

  const immutableRulesValue = bibleValue.immutableRules;

  if (!Array.isArray(immutableRulesValue)) {
    return { ok: false, error: "bible.immutableRules 必须是字符串数组。" };
  }

  if (immutableRulesValue.length < 3 || immutableRulesValue.length > 10) {
    return { ok: false, error: "bible.immutableRules 必须包含 3 到 10 条规则。" };
  }

  const immutableRules: string[] = [];

  for (const rule of immutableRulesValue) {
    if (typeof rule !== "string") {
      return { ok: false, error: "bible.immutableRules 的每一项都必须是字符串。" };
    }

    const cleaned = rule.trim();

    if (!cleaned) {
      return { ok: false, error: "bible.immutableRules 不能包含空规则。" };
    }

    if (cleaned.length > 360) {
      return { ok: false, error: "bible.immutableRules 单项不能超过 360 字符。" };
    }

    immutableRules.push(cleaned);
  }

  if (!Array.isArray(value.characters)) {
    return { ok: false, error: "characters 必须是数组。" };
  }

  if (value.characters.length < 3 || value.characters.length > 8) {
    return { ok: false, error: "characters 必须包含 3 到 8 个主要角色。" };
  }

  const characters: CharacterCard[] = [];
  const characterNames = new Set<string>();

  for (const [index, item] of value.characters.entries()) {
    if (!isRecord(item)) {
      return { ok: false, error: `characters[${index}] 必须是 JSON object。` };
    }

    const characterExtraKeyError = validateExactKeys(
      item,
      characterSchemaKeySet,
      `characters[${index}]`,
    );

    if (characterExtraKeyError) {
      return { ok: false, error: characterExtraKeyError };
    }

    const missingCharacterKeys = characterTextFields.filter((key) => !(key in item));

    if (missingCharacterKeys.length > 0) {
      return {
        ok: false,
        error: `characters[${index}] 缺少字段：${missingCharacterKeys.join(", ")}。`,
      };
    }

    const character = {} as Record<(typeof characterTextFields)[number], string>;

    for (const field of characterTextFields) {
      const rawValue = item[field];

      if (typeof rawValue !== "string") {
        return { ok: false, error: `characters[${index}].${field} 必须是字符串。` };
      }

      const cleaned = rawValue.trim();

      if (!cleaned) {
        return { ok: false, error: `characters[${index}].${field} 不能为空。` };
      }

      const maxLength = field === "name" ? 120 : 1200;

      if (cleaned.length > maxLength) {
        return {
          ok: false,
          error: `characters[${index}].${field} 超过 ${maxLength} 字符。`,
        };
      }

      character[field] = cleaned;
    }

    if (characterNames.has(character.name)) {
      return { ok: false, error: `characters 包含重复角色名：${character.name}。` };
    }

    characterNames.add(character.name);
    characters.push({
      name: character.name,
      role: character.role,
      appearance: character.appearance,
      personality: character.personality,
      goal: character.goal,
      weakness: character.weakness,
      secret: character.secret,
      relationshipToProtagonist: character.relationshipToProtagonist,
      characterArc: character.characterArc,
    });
  }

  return {
    ok: true,
    bible: {
      worldview: bible.worldview,
      powerSystem: bible.powerSystem,
      majorFactions: bible.majorFactions,
      mainPlot: bible.mainPlot,
      firstVolumePlot: bible.firstVolumePlot,
      protagonistArc: bible.protagonistArc,
      antagonistPlan: bible.antagonistPlan,
      midLateForeshadowing: bible.midLateForeshadowing,
      finalTruth: bible.finalTruth,
      immutableRules,
    },
    characters,
  };
}

export function buildBiblePrompt(input: BiblePromptInput) {
  return [
    "你是严谨的长篇网文故事圣经策划。请基于用户已保存的 story_config 和 story_concept 生成故事圣经与主要角色卡。",
    "",
    "硬性要求：",
    "- 只生成故事圣经和主要角色卡，不生成章节大纲、章节正文、改写、续写、商业化、社区或排行榜内容。",
    "- 输出必须是 JSON object，必须可被 JSON.parse 解析，不要使用 Markdown，不要添加解释文字。",
    "- 故事圣经要服务后续章节大纲，但本次不得写章节大纲。",
    "- 角色卡必须覆盖主角、关键同伴或关系角色、主要反派或核心阻力角色。",
    "",
    "已保存 story_config：",
    `- 作品名：${input.project.title}`,
    `- 一句话简介：${input.project.description || "未填写"}`,
    ...buildStoryConfigPromptLines(input.config),
    "",
    "已保存 story_concept：",
    `- workTitle：${input.concept.workTitle}`,
    `- logline：${input.concept.logline}`,
    `- premise：${input.concept.premise}`,
    `- protagonist：${input.concept.protagonist}`,
    `- protagonistGoal：${input.concept.protagonistGoal}`,
    `- protagonistWeakness：${input.concept.protagonistWeakness}`,
    `- antagonistOrObstacle：${input.concept.antagonistOrObstacle}`,
    `- worldRules：${input.concept.worldRules}`,
    `- surfaceConflict：${input.concept.surfaceConflict}`,
    `- middleConflict：${input.concept.middleConflict}`,
    `- deepConflict：${input.concept.deepConflict}`,
    `- firstVolumeHook：${input.concept.firstVolumeHook}`,
    `- readerHookQuestions：${input.concept.readerHookQuestions.join("；")}`,
    "",
    "目标 JSON 结构示例（必须输出同结构 JSON object，不要照抄示例内容）：",
    bibleJsonStructureExample,
  ].join("\n");
}
