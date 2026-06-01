export type PaymentProvider = "placeholder" | "stripe" | "wechat" | "alipay";

export type CreditOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

export type CreditPackage = {
  packageId: string;
  packageName: string;
  creditsAmount: number;
  priceAmount: number;
  currency: string;
};
