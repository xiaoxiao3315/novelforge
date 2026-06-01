import type { CreditPackage } from "@/lib/payments/types";

export const CREDIT_PACKAGES = [
  {
    packageId: "credits_30",
    packageName: "轻量补给",
    creditsAmount: 30,
    priceAmount: 0,
    currency: "CNY",
  },
  {
    packageId: "credits_100",
    packageName: "连载常用",
    creditsAmount: 100,
    priceAmount: 0,
    currency: "CNY",
  },
  {
    packageId: "credits_300",
    packageName: "长篇储备",
    creditsAmount: 300,
    priceAmount: 0,
    currency: "CNY",
  },
] as const satisfies readonly CreditPackage[];

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]["packageId"];

export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find((item) => item.packageId === packageId) ?? null;
}
