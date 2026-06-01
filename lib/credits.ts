import type { SupabaseClient } from "@supabase/supabase-js";
export {
  CREDIT_PACKAGES,
  getCreditPackage,
  type CreditPackageId,
} from "@/lib/payments/packages";

export const INITIAL_TEST_CREDITS = 1000;

export const GENERATION_CREDIT_COSTS = {
  generate_concept: 1,
  generate_bible: 3,
  generate_outline: 5,
  generate_chapter: 8,
  generate_chapter_summary: 0,
  set_official: 0,
} as const;

export type GenerationCreditOperation = keyof typeof GENERATION_CREDIT_COSTS;

type SpendCreditsRow = {
  transaction_id: string;
  balance_after: number;
};

export function getGenerationCreditCost(operation: GenerationCreditOperation) {
  return GENERATION_CREDIT_COSTS[operation];
}

export function formatCreditShortfall(balance: number, cost: number) {
  const shortage = Math.max(0, cost - balance);

  return `点数不足：当前余额 ${balance} 点，本次操作需要 ${cost} 点，还差 ${shortage} 点。后续可在 /account/credits 购买生成点数。`;
}

export async function ensureCreditAccount(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_or_create_credit_balance");

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (typeof data !== "number") {
    return { ok: false as const, error: "点数账户初始化失败。", status: 500 };
  }

  return { ok: true as const, balance: data };
}

export async function requireGenerationCredits(
  supabase: SupabaseClient,
  operation: GenerationCreditOperation,
) {
  const cost = getGenerationCreditCost(operation);
  const account = await ensureCreditAccount(supabase);

  if (!account.ok) {
    return account;
  }

  if (account.balance < cost) {
    return {
      ok: false as const,
      error: formatCreditShortfall(account.balance, cost),
      status: 402,
      balance: account.balance,
    };
  }

  return { ok: true as const, balance: account.balance, cost };
}

export async function spendGenerationCredits({
  supabase,
  projectId,
  generationLogId,
  operation,
  reason,
}: {
  supabase: SupabaseClient;
  projectId: string;
  generationLogId: string | null;
  operation: GenerationCreditOperation;
  reason: string;
}) {
  const amount = getGenerationCreditCost(operation);

  if (amount <= 0) {
    return { ok: true as const, amount: 0, balanceAfter: null, transactionId: null };
  }

  const { data, error } = await supabase.rpc("spend_generation_credits", {
    p_project_id: projectId,
    p_generation_log_id: generationLogId,
    p_operation: operation,
    p_amount: amount,
    p_reason: reason,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const row = Array.isArray(data) ? (data[0] as SpendCreditsRow | undefined) : undefined;

  if (!row) {
    return { ok: false as const, error: "点数扣除失败。" };
  }

  return {
    ok: true as const,
    amount,
    balanceAfter: row.balance_after,
    transactionId: row.transaction_id,
  };
}
