# WO-Q001 Novel Quality Engine 方案设计

## 0. 边界

本方案只做设计，不改现有生成流程。

- 不改现有 API。
- 不改现有 prompt。
- 不改数据库。
- 不新增 migration。
- 不接入新的外部服务。
- 不读取 `.env.local`。
- 不改变 classic / interactive / UI 分支行为。

目标是为后续 WO-Q002 提供可以落地的模块规划，让 NovelForge 从“一次生成章节正文”演进为“可控成本的多阶段写作流水线”。

## 1. 当前章节生成质量瓶颈

当前章节生成链路已经具备可用的上下文：`story_config`、`story_concept`、`story_bible`、`characters`、`volume`、`chapter outline`、前文摘要、导演指令、互动选择和互动状态。主要瓶颈不在上下文缺失，而在“一次性正文生成”本身。

### 1.1 单次生成同时承担太多职责

当前 `generate_chapter` 一次 prompt 同时要求模型完成：

- 遵守设定和不可变规则。
- 吸收前文摘要。
- 完成当前章节事件、冲突、伏笔、人物变化。
- 控制字数。
- 保持中文网文正文格式。
- 吸收导演指令。
- 吸收 interactive decision / state。
- 留出结尾钩子。

这会导致模型在复杂章节里优先完成“信息覆盖”，但牺牲节奏、情绪层次、角色声线和段落推进。

### 1.2 缺少写前章节策略

`chapter outline` 已经有事件、冲突、变化和钩子，但正文生成前没有独立的“本章写作策略”阶段。模型不会先明确：

- 本章主戏是哪一场。
- 本章爽点或情绪爆点在哪。
- 哪个角色推动冲突。
- 哪些信息必须延后揭露。
- 哪些段落应该快，哪些段落应该慢。

结果容易出现“把大纲展开成说明文”的问题。

### 1.3 角色声音容易趋同

角色卡提供了性格、目标、弱点、秘密和关系，但正文阶段没有强制输出“本章角色声音约束”。多个角色对话容易都像旁白，缺少：

- 句长差异。
- 语气差异。
- 关注点差异。
- 关系张力下的潜台词。

### 1.4 情绪和冲突缺少二次校验

当前生成后会生成 continuity summary，但 summary 更关注事实沉淀，不评估文本质量。因此正文可能满足大纲，却存在：

- 冲突被快速讲完。
- 角色内心变化缺少铺垫。
- 情绪峰值不足。
- 章末钩子只是“发生了新事”，没有“读者想点下一章”的压力。

### 1.5 设定漂移只能事后由人发现

当前 prompt 要求遵守 `story_bible`，但没有独立的连续性检查输出。设定漂移可能体现在：

- 世界规则被临时改写。
- 能力代价变轻。
- 前文事件被错误回忆。
- 角色关系状态突然跳跃。
- interactive state 的数值和正文表现不一致。

### 1.6 没有质量评分和可解释缺陷

用户现在只能看到正文结果，无法知道这一版好在哪里、弱在哪里、是否值得重生成。系统也没有可用于后续分析的质量维度。

## 2. 是否适合使用小说 Agent

适合，但不建议第一版就做完全自治多 Agent。

### 2.1 适合的原因

小说章节质量由多种角色能力组成：策划、角色导演、写手、编辑、连续性检查。把这些职责拆开，可以让每一步输出更明确、可验证、可记录。

适合 Agent 化的职责包括：

- 将大纲转化为本章写作策略。
- 为角色生成本章声线和潜台词约束。
- 对正文进行质量批注和评分。
- 对照 story_bible 和 summary 做一致性检查。
- 根据批注重写，而不是盲目重生成。

### 2.2 不建议第一版完全自治的原因

完整 Agent 架构会带来明显成本和失败面：

- 多次模型调用增加点数消耗。
- 每个 Agent 都可能输出不稳定 JSON。
- 审稿和修订循环如果不设上限，会消耗过多。
- 多 Agent 之间可能互相放大风格偏好，导致过度润色。
- 复杂度过早进入 API 和 UI，会影响现有 classic / interactive 稳定性。

因此建议采用“两层策略”：

- 架构设计上保留六 Agent 职责。
- MVP 只落地 Draft / Critique / Rewrite 三段流水线。

## 3. 推荐 Agent 架构

### 3.1 剧情策划 Agent

职责：把当前章节大纲转化为可执行的写作策略。

输入：

- story_config
- story_concept
- story_bible
- volume
- current chapter outline
- previous chapter summaries
- directorInstruction
- interactive decision / state

输出：

- 本章核心戏。
- 本章读者期待。
- 本章冲突推进节拍。
- 必须出现的剧情节点。
- 必须延后揭露的信息。
- 结尾钩子目标。

价值：解决节奏平、大纲说明化、钩子弱。

### 3.2 角色导演 Agent

职责：为本章主要角色生成声线、欲望、隐瞒、动作和对话约束。

输入：

- characters
- story_bible
- previous summaries
- current chapter outline
- interactive state relationships

输出：

- 本章出场角色表。
- 每个角色的当前目标。
- 每个角色不能明说的信息。
- 对话风格和禁忌。
- 关系张力表现方式。

价值：解决角色声音相似、关系变化突然、对话像说明。

### 3.3 正文写手 Agent

职责：基于写作策略和角色导演约束生成章节正文。

输入：

- 当前已有 chapter prompt input
- plot plan
- character direction
- style constraints

输出：

- chapter body
- self notes 可选，用于记录写手认为已完成的关键点，不展示给用户

价值：聚焦正文表现，不再同时承担审稿职责。

### 3.4 审稿编辑 Agent

职责：按质量维度审稿，指出可修订问题。

输入：

- chapter body
- story_bible
- characters
- chapter outline
- previous summaries
- directorInstruction
- interactive decision / state

输出：

- quality scores
- issue list
- rewrite instructions
- whether rewrite is required
- do-not-change list

价值：给系统一个“生成后判断”，避免用户只能盲重试。

### 3.5 修订 Agent

职责：根据审稿意见重写正文。

输入：

- original body
- critique
- protected facts
- same chapter context

输出：

- revised body
- applied changes summary

价值：比重新生成更保留已成功的剧情内容，降低漂移。

### 3.6 连续性检查 Agent

职责：对正文做事实、设定和互动状态一致性检查。

输入：

- revised body 或 draft body
- story_bible immutableRules
- characters
- previous summaries
- current chapter outline
- interactive state

输出：

- continuity pass / fail
- violations
- severity
- suggested fixes

价值：避免设定漂移、前文错乱、互动状态失真。

## 4. 第一版最小可行方案：Draft / Critique / Rewrite

第一版不实现完整六 Agent，只实现三段：

1. Draft：沿用当前章节生成能力，生成初稿。
2. Critique：对初稿做结构化质量评估。
3. Rewrite：仅在高质量模式下按 critique 重写一次。

### 4.1 普通生成

普通模式保持现有行为：

- 一次正文生成。
- 一次章节摘要生成。
- 写入 chapter_versions。
- 更新 chapters.content.draft 和 chapters.content.summary。
- 记录 `generate_chapter` 与 `generate_chapter_summary`。

### 4.2 高质量生成

高质量模式建议顺序：

1. Draft 调用：生成初稿。
2. Critique 调用：输出质量评分和修订建议。
3. 如果 critique 分数达到阈值，可直接使用 draft。
4. 如果低于阈值，Rewrite 调用：按 critique 重写一次。
5. 对最终正文生成 summary。
6. 保存最终正文为 chapter version。
7. 在 generation_logs 记录完整 pipeline。

### 4.3 为什么 MVP 不先做 Plot Plan

Plot Plan 很有价值，但会新增一个模型调用。MVP 如果先做 Draft / Critique / Rewrite，可以最直接验证“审稿和修订是否真的提升正文质量”。等 WO-Q002 或 WO-Q003 验证有效后，再补剧情策划 Agent。

## 5. 输入 / 输出数据结构建议

以下结构是未来实现建议，不要求 WO-Q001 落地代码。

### 5.1 QualityGenerationMode

```ts
type QualityGenerationMode = "standard" | "quality";
```

### 5.2 NovelQualityPipelineInput

```ts
type NovelQualityPipelineInput = {
  mode: QualityGenerationMode;
  project: {
    id: string;
    title: string;
    description: string | null;
  };
  storyConfig: StoryConfigPromptData;
  storyConcept: StoryConcept;
  storyBible: StoryBible;
  characters: CharacterCard[];
  volume: VolumeOutline;
  chapter: ChapterOutline;
  previousChapters: PreviousChapterContext[];
  intervention: ChapterIntervention;
  previousDecision?: ChapterDecision | null;
  currentDecision?: ChapterDecision | null;
  interactiveState?: InteractiveStoryState | null;
  wordTarget: number;
};
```

### 5.3 DraftOutput

```ts
type DraftOutput = {
  body: string;
  model: string;
  promptVersion: string;
  wordTarget: number;
  generatedAt: string;
  source: "standard-draft" | "quality-draft";
};
```

### 5.4 QualityScores

```ts
type QualityScoreKey =
  | "pacing"
  | "conflict"
  | "emotion"
  | "characterConsistency"
  | "settingConsistency"
  | "languageTexture"
  | "endingHook";

type QualityScores = Record<QualityScoreKey, number>;
```

建议分值范围：1 到 5。不要用 100 分制，避免模型输出看似精确但不可解释。

### 5.5 CritiqueIssue

```ts
type CritiqueIssue = {
  dimension: QualityScoreKey;
  severity: "low" | "medium" | "high";
  locationHint: string;
  problem: string;
  rewriteAdvice: string;
};
```

### 5.6 CritiqueOutput

```ts
type CritiqueOutput = {
  scores: QualityScores;
  overallScore: number;
  strengths: string[];
  issues: CritiqueIssue[];
  rewriteRequired: boolean;
  rewriteFocus: string[];
  doNotChange: string[];
  pacingGuardrails: string[];
  generatedAt: string;
  model: string;
  promptVersion: string;
};
```

`pacingGuardrails` 是防止过度润色的关键字段，例如：

- 不增加长篇背景解释。
- 不扩写已完成的信息交代。
- 保留爽点段落的直接推进。
- 保留章末悬念，不提前解释。

### 5.7 RewriteInput

```ts
type RewriteInput = {
  originalBody: string;
  critique: CritiqueOutput;
  protectedContext: {
    mustKeepFacts: string[];
    outlineRequirements: string[];
    immutableRules: string[];
    selectedInteractiveChoice?: string | null;
  };
  maxRewritePasses: 1;
};
```

### 5.8 RewriteOutput

```ts
type RewriteOutput = {
  body: string;
  appliedChanges: string[];
  preservedElements: string[];
  model: string;
  promptVersion: string;
  generatedAt: string;
};
```

### 5.9 QualityMetadata

最终可嵌入 `chapters.content.draft.quality` 或 `chapter_versions.summary` 旁边的结构。

```ts
type QualityMetadata = {
  mode: QualityGenerationMode;
  pipelineVersion: string;
  draft?: DraftOutput;
  critique?: CritiqueOutput;
  rewrite?: Omit<RewriteOutput, "body">;
  finalSource: "draft" | "rewrite";
};
```

正文 body 仍保存在现有 `chapter_versions.body` 和 `chapters.content.draft.body`，不建议把多份正文都塞进 `chapters.content`。

## 6. 如何复用现有数据

### 6.1 story_config

复用题材、背景、世界、主角、核心冲突、基调、连载结构和 `config_json.mode`。

用途：

- 确定文风和读者预期。
- 判断 classic / interactive 上下文。
- 未来可把默认生成质量模式放入 `config_json.qualityMode`，不需要新增列。

### 6.2 story_concept

复用 logline、premise、主角目标、弱点、障碍、世界规则、冲突层次和第一卷钩子。

用途：

- Critique 判断本章是否服务核心卖点。
- Rewrite 避免偏离作品承诺。

### 6.3 story_bible

复用 worldview、powerSystem、majorFactions、mainPlot、firstVolumePlot、protagonistArc、antagonistPlan、midLateForeshadowing、finalTruth、immutableRules。

用途：

- 连续性检查。
- Rewrite 的 `doNotChange` 和 `protectedContext`。
- 审稿时判断设定一致性。

### 6.4 characters

复用角色卡中的 role、appearance、personality、goal、weakness、secret、relationshipToProtagonist、characterArc。

用途：

- 角色声音评估。
- 对话和行动动机检查。
- Rewrite 中保护角色性格。

### 6.5 volumes

复用 volume summary、mainConflict、endingHook。

用途：

- 判断本章是否服务当前卷主冲突。
- 避免单章写飞。

### 6.6 chapters

复用当前 chapter outline 字段：

- title
- event
- conflict
- character_change
- highlight
- foreshadowing
- ending_hook
- estimated_words
- content

用途：

- Draft 的硬性要求。
- Critique 检查是否完成大纲。
- Rewrite 保护大纲事实。

### 6.7 chapter summaries

复用 `chapters.content.summary` 和 official summary。

用途：

- 生成前文连续性上下文。
- 设定漂移检查。
- Critique 的人物一致性、设定一致性评分。

### 6.8 director instructions

复用现有 `ChapterIntervention`：

- directorInstruction
- styleFocus
- mustInclude
- mustAvoid
- endingRequirement

用途：

- Draft 和 Rewrite 都必须吸收。
- Critique 检查是否执行。

### 6.9 interactive decision / state

复用：

- previousDecision
- currentDecision
- interactiveState
- stateChanges

用途：

- Draft 明确吸收上一章选择。
- Critique 检查正文是否体现选择影响。
- Rewrite 保护用户已选方向。
- Route tendency 可作为高质量模式的剧情权重。

## 7. generation_logs 记录建议

优先复用现有 `generation_logs`，不新增表。

### 7.1 普通模式记录

保持现有：

- `operation: "generate_chapter"`
- `operation: "generate_chapter_summary"`

### 7.2 高质量模式记录方式

建议增加新的 operation 文本，不需要 migration：

- `quality_chapter_draft`
- `quality_chapter_critique`
- `quality_chapter_rewrite`
- `quality_chapter_pipeline`

可选方案：

1. 每一步一条日志：便于排查，成本记录更清楚。
2. pipeline 总日志一条：便于 UI 展示。

推荐第一版采用“每一步一条日志 + pipeline 总日志”。

### 7.3 Draft log

```ts
{
  operation: "quality_chapter_draft",
  target_type: "chapter",
  target_id: chapterId,
  model,
  prompt_version: "chapter-quality-draft-v1",
  input: pipelineInput,
  output: {
    draft: {
      bodyPreview,
      wordCount,
      source: "quality-draft"
    }
  }
}
```

正文完整内容仍保存到 `chapter_versions.body`，日志里建议只存 preview 或长度，避免日志膨胀。

### 7.4 Critique log

```ts
{
  operation: "quality_chapter_critique",
  target_type: "chapter",
  target_id: chapterId,
  model,
  prompt_version: "chapter-quality-critique-v1",
  input: {
    pipelineInputWithoutFullBibleIfNeeded,
    draftPreview,
    draftLength
  },
  output: {
    critique: CritiqueOutput
  }
}
```

### 7.5 Rewrite log

```ts
{
  operation: "quality_chapter_rewrite",
  target_type: "chapter",
  target_id: chapterId,
  model,
  prompt_version: "chapter-quality-rewrite-v1",
  input: {
    critique: CritiqueOutput,
    protectedContext,
    originalBodyPreview,
    originalLength
  },
  output: {
    rewrite: {
      bodyPreview,
      appliedChanges,
      preservedElements,
      wordCount
    }
  }
}
```

### 7.6 Pipeline log

```ts
{
  operation: "quality_chapter_pipeline",
  target_type: "chapter",
  target_id: chapterId,
  model,
  prompt_version: "chapter-quality-pipeline-v1",
  input: {
    mode: "quality",
    costs,
    thresholds
  },
  output: {
    finalSource: "draft" | "rewrite",
    scores,
    rewriteRequired,
    logIds,
    chapterVersionId
  },
  error: null
}
```

失败时只写 error，不写脏正文，不扣成功点数。

## 8. 是否需要新增表

第一版不需要新增表，也不建议新增 migration。

现有结构足够：

- `chapter_versions` 保存每次最终正文版本。
- `chapters.content.draft` 保存当前草稿。
- `chapters.content.summary` 保存连续性摘要。
- `generation_logs` 保存多阶段过程。
- `credit_transactions` 已可关联 generation log。

可复用 JSON 字段：

- `chapters.content.draft.quality`
- `chapter_versions.summary.quality` 不推荐，summary 应保持连续性语义。
- `generation_logs.output.critique`
- `generation_logs.output.pipeline`

推荐：

- 质量过程主要放 `generation_logs`。
- 当前草稿只保存必要 `quality` 摘要，例如 mode、overallScore、finalSource、pipelineVersion。
- 不把所有中间正文塞进 `chapters.content`。

未来什么时候需要新增表：

- 用户需要查看历史 critique 明细。
- 需要质量评分排行榜或分析报表。
- 需要跨版本比较。
- 需要人工编辑批注系统。

这些都不是 WO-Q002 的必要条件。

## 9. 成本与点数建议

当前 `generate_chapter` 成本是 8 点，summary 是 0 点。

### 9.1 普通生成

保持 8 点：

- Draft 正文一次。
- Summary 一次，仍可视为附带。
- 成功后扣点。

### 9.2 高质量生成

建议 18 到 24 点之间，第一版推荐 20 点。

成本构成：

- Draft：8 点。
- Critique：4 点。
- Rewrite：8 点。
- Summary：0 点。
- Pipeline 管理溢价：0 到 4 点。

建议第一版固定 20 点，原因：

- 用户能理解“约等于 2.5 次普通生成”。
- 系统最多调用 3 次正文相关模型。
- 不需要做复杂动态计价。

### 9.3 修订生成

修订生成是用户已有正文后的“只重写一次”能力，建议 10 到 12 点。

两种策略：

- 有现成 critique：只调用 Rewrite，8 到 10 点。
- 没有 critique：Critique + Rewrite，12 点。

### 9.4 点数扣除时机

推荐：

- 进入高质量模式前先检查余额是否足够全额成本。
- 只有最终正文保存成功、pipeline log 写入成功后扣点。
- 中间步骤失败不扣点。
- 如果最终正文已保存但日志或扣点失败，沿用现有策略返回明确错误，并避免生成孤儿状态。

### 9.5 防止成本失控

- MVP 固定最多一次 Rewrite。
- Critique 不允许触发二次 Critique。
- Rewrite 后不再自动审稿。
- 用户手动再次修订才另扣点。
- 若 draft overallScore 已达到阈值，比如 4.2/5，可跳过 Rewrite，但仍按高质量模式扣费还是按实际调用扣费需要产品决定。第一版建议固定扣费，降低实现复杂度；后续可优化为按调用扣费。

## 10. 前端开关设计

### 10.1 开关位置

推荐放在章节生成按钮附近，属于本次生成参数，不作为全局项目设置强制保存。

显示：

- 普通模式：快速生成，8 点。
- 高质量模式：生成 + 审稿 + 修订，20 点。

### 10.2 交互形态

用 segmented control：

- 普通模式
- 高质量模式

按钮文案随模式变化：

- 普通模式：`生成章节正文 · 8 点`
- 高质量模式：`高质量生成 · 20 点`

### 10.3 状态展示

高质量模式生成时建议展示阶段状态：

1. 正在生成初稿。
2. 正在审稿评分。
3. 正在修订正文。
4. 正在生成连续性摘要。
5. 正在保存版本。

### 10.4 classic / interactive 兼容

同一个开关可用于两种模式，但上下文不同：

- classic：没有 interactive state，Critique 跳过互动一致性。
- interactive：Critique 必须检查上一章选择和 route tendency 是否体现在正文中。

不要拆两个 UI 分支。用现有 `getProjectModeFromConfig` 控制输入上下文即可。

## 11. 质量评估维度

每个维度 1 到 5 分，并输出简短原因。

### 11.1 节奏 pacing

检查：

- 是否有明确场景推进。
- 是否避免长段说明。
- 是否每 600 到 900 字有一次新信息、新动作或新压力。
- 是否有快慢变化。

低分信号：

- 大量解释设定。
- 角色反复想同一件事。
- 冲突被旁白总结。

### 11.2 冲突 conflict

检查：

- 本章核心冲突是否清楚。
- 冲突是否升级。
- 主角是否做了选择或付出代价。
- 对抗是否体现在行动和对话中。

低分信号：

- 大纲冲突只是被提到。
- 没有阻力。
- 没有即时压力。

### 11.3 情绪 emotion

检查：

- 是否有情绪起伏。
- 情绪是否来自事件和关系，而不是直接说明。
- 高潮段是否有足够铺垫。

低分信号：

- “他很震惊”“她很难过”过多。
- 情绪没有行为表现。
- 情绪反应与角色关系不匹配。

### 11.4 人物一致性 characterConsistency

检查：

- 行动是否符合目标、弱点和秘密。
- 对话是否区分角色。
- 关系变化是否有因果。

低分信号：

- 所有人说话都像同一个作者。
- 角色突然知道不该知道的信息。
- 角色态度跳变。

### 11.5 设定一致性 settingConsistency

检查：

- 是否违反 immutableRules。
- 能力系统、阵营、世界规则是否稳定。
- 前文事实是否被改写。

低分信号：

- 为了爽点临时降低代价。
- 把伏笔提前说破。
- 与 previous summaries 冲突。

### 11.6 语言质感 languageTexture

检查：

- 句式是否有变化。
- 描写是否服务场景和情绪。
- 是否有符合类型的画面感。
- 是否避免模板化 AI 腔。

低分信号：

- 连续抽象词。
- 过度华丽但不推进。
- 成语堆叠。

### 11.7 结尾钩子 endingHook

检查：

- 是否呼应 outline 的 ending_hook。
- 是否留下明确下一章问题。
- 是否让读者关心后果。

低分信号：

- 只是“他不知道接下来会发生什么”。
- 钩子和本章主冲突无关。
- 已经解释过度，没有悬念。

## 12. 避免过度润色导致网文节奏变慢

Rewrite prompt 必须加入“网文节奏保护”。

建议硬规则：

- 不扩写背景设定，除非 critique 明确指出设定缺失影响理解。
- 不把动作戏改成心理散文。
- 不把短促对话全部改成长句。
- 不新增超过 15% 字数，除非原文严重不足。
- 不提前解释伏笔。
- 不删除爽点、反转、危险和章末压力。
- 优先增强动作、选择、代价、关系张力，而不是增加形容词。

Critique 的 rewriteAdvice 也要约束：

- 每条建议必须指向可执行修改。
- 不允许泛泛要求“更细腻”“更文学”。
- 必须说明修改后不能牺牲什么。

## 13. 避免 AI 审稿循环过度消耗点数

第一版必须禁止自动循环。

建议规则：

- 高质量生成最多 Draft + Critique + Rewrite。
- Rewrite 后不自动再 Critique。
- Critique 只输出一次。
- 用户可以手动“再次修订”，但单独计费。
- 每个 chapter version 最多保留一个关联 quality pipeline。
- 如果 Critique 输出无效 JSON，最多重试一次。
- 如果 Rewrite 失败，不保存半成品，不扣高质量完整费用。

可选阈值：

- overallScore >= 4.2：跳过 Rewrite。
- any dimension <= 2：必须 Rewrite。
- settingConsistency <= 2：Rewrite 必须优先修复设定一致性。
- endingHook <= 2：Rewrite 必须重写末段，但不得续写下一章。

## 14. 后续 WO 拆分建议

### WO-Q002：质量引擎类型与 prompt 草案

范围：

- 新增 `lib/quality/types.ts`。
- 新增 `prompts/chapter-quality-critique.ts`。
- 新增 `prompts/chapter-quality-rewrite.ts`。
- 只写纯函数和 schema validation。
- 不接 API。
- 不改现有生成 route。

验收：

- typecheck 通过。
- lint 通过。
- 单元或本地静态校验通过。

### WO-Q003：高质量 pipeline service

范围：

- 新增 `lib/quality/chapter-quality-pipeline.ts`。
- 封装 Draft / Critique / Rewrite 顺序。
- 使用现有 DeepSeek wrapper。
- 不改 API，只准备可调用服务。

验收：

- service 可被测试输入调用。
- 失败时不返回脏正文。
- 结构化输出稳定。

### WO-Q004：API 接入但不改默认行为

范围：

- 在现有 generate chapter API 增加可选 `qualityMode` 参数。
- 默认仍是普通模式。
- 高质量模式走 pipeline。
- 保持 classic / interactive 输入复用。

验收：

- 不传 `qualityMode` 时现有行为不变。
- 高质量模式写入 generation_logs。
- 点数余额不足返回 402。

### WO-Q005：前端模式开关

范围：

- 章节生成区增加普通 / 高质量 segmented control。
- 展示成本。
- 展示阶段状态。
- 不改项目导航和其他页面。

验收：

- classic 可用。
- interactive 可用。
- 点数不足提示可用。

### WO-Q006：质量报告展示

范围：

- 在章节版本或生成结果旁显示质量评分摘要。
- 展示 strengths、issues、finalSource。
- 不做复杂历史报表。

验收：

- 用户能看见评分和改进点。
- 不阻塞正文阅读。

### WO-Q007：剧情策划 Agent

范围：

- 在高质量模式前增加 Plot Plan。
- 验证是否比直接 Draft / Critique / Rewrite 更稳定。

验收：

- 质量提升可解释。
- 成本可控。

### WO-Q008：连续性检查 Agent

范围：

- 对最终正文做 consistency check。
- 只做阻断严重设定冲突，不做无限修订。

验收：

- 严重违反 immutableRules 时不保存正文。
- 错误写入 generation_logs.error。

## 15. 是否建议进入 WO-Q002

建议进入 WO-Q002。

原因：

- 当前仓库已有足够上下文和存储缝隙，不需要先做数据库改造。
- MVP 可以从纯类型、prompt 和 validation 开始，不会影响现有生成流程。
- Draft / Critique / Rewrite 能最快验证质量收益。
- 成本和循环风险可以通过“一次 Rewrite 上限”控制。

WO-Q002 不应接 API，也不应改现有 `prompts/chapter.ts`。它只应该产出质量引擎的类型、Critique prompt、Rewrite prompt 和校验函数，为 WO-Q003 service 做准备。
