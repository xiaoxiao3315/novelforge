export const GENERATION_CREDIT_COSTS = {
  generate_concept: 1,
  generate_bible: 3,
  generate_outline: 5,
  generate_chapter: 8,
  generate_chapter_quality: 20,
  claim_read_chapter: 8,
  generate_chapter_summary: 0,
  set_official: 0,
} as const;

export type GenerationCreditOperation = keyof typeof GENERATION_CREDIT_COSTS;

export function getGenerationCreditCost(operation: GenerationCreditOperation) {
  return GENERATION_CREDIT_COSTS[operation];
}

export function formatCreditShortfall(balance: number, cost: number) {
  const shortage = Math.max(0, cost - balance);

  return `点数不足：当前余额 ${balance} 点，本次操作需要 ${cost} 点，还差 ${shortage} 点。后续可在 /account/credits 购买生成点数。`;
}
