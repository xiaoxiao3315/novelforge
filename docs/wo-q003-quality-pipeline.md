# WO-Q003 质量生成 Pipeline Service

WO-Q003 新增 `lib/quality/pipeline.ts`，用于表达 `Draft -> Critique -> Rewrite` 的章节质量生成流水线。本轮只提供可复用 service，不接入现有 API。

## 当前不做

- 不新增 API route。
- 不修改 `/api/generate/chapter`。
- 不修改 `prompts/chapter.ts` 默认行为。
- 不新增 migration。
- 不改数据库、点数系统、DeepSeek provider 或 UI。
- 不写 `generation_logs`。
- 不扣点。

## 架构

Pipeline 通过依赖注入接收模型能力：

```ts
type QualityPipelineModel = {
  generateDraft(input): Promise<string>;
  generateCritique(input): Promise<unknown>;
  generateRewrite(input): Promise<string>;
};
```

因此它不绑定 DeepSeek，也不直接调用任何外部服务。WO-Q004 如果接入 API，可以在 API 层把现有 draft 生成、critique prompt 调用、rewrite prompt 调用包装成这些 callback。

## 支持模式

`draftSource`：

- `generate`：由 `generateDraft` callback 生成初稿。
- `existing`：外部传入已有初稿，适合“对现有草稿做质量修订”。

`rewritePolicy`：

- `always`：critique 校验成功后总是 rewrite。
- `score-threshold`：默认策略，`overallScore < 82` 才 rewrite。
- `never`：只 critique，不 rewrite，`finalText = draft`。

## 错误处理

- Draft 失败：返回 failed，不进入 critique。
- Critique 输出未通过 `normalizeChapterQualityCritique`：返回 failed，不进入 rewrite。
- Rewrite 失败：返回 failed，但保留 draft 和 critique，供 API 层决定如何展示或记录。
- 不做无限循环，不做二次审稿，不做二次 rewrite。

## Fake usage

```ts
import { runChapterQualityPipeline } from "@/lib/quality";

const result = await runChapterQualityPipeline(
  {
    storyContext,
    draftSource: "existing",
    existingDraft: "这里是一章已有草稿。",
    rewritePolicy: "score-threshold",
    rewriteScoreThreshold: 82,
  },
  {
    async generateDraft() {
      return "这里是生成初稿。";
    },
    async generateCritique() {
      return {
        scores: {
          pacing: 76,
          conflict: 80,
          emotion: 72,
          characterConsistency: 84,
          worldConsistency: 88,
          proseQuality: 78,
          hookStrength: 68,
          commercialAppeal: 74,
        },
        overallScore: 76,
        strengths: ["主冲突清晰。"],
        weaknesses: ["结尾压力不足。"],
        revisionDirectives: ["强化末段危险和下一章追问。"],
        continuityRisks: [],
        mustKeep: ["保留主角主动选择。"],
        mustFix: ["重写章末钩子。"],
      };
    },
    async generateRewrite() {
      return "这里是修订后的章节正文。";
    },
  },
);
```

## WO-Q004 接入建议

WO-Q004 可在 API 层新增可选 `qualityMode` 参数，但默认仍保持普通章节生成不变。API 层负责：

1. 组装现有章节上下文。
2. 注入 DeepSeek draft / critique / rewrite callback。
3. 调用 `runChapterQualityPipeline`。
4. 保存最终正文和 summary。
5. 写入 `generation_logs`。
6. 扣除高质量模式点数。

这些持久化和扣费动作都不属于 WO-Q003。
