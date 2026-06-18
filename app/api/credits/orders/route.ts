import { NextResponse } from "next/server";
import { getCreditPackage } from "@/lib/payments/packages";
import type { CreditOrderStatus, PaymentProvider } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

type CreateCreditOrderBody = {
  packageId?: unknown;
  user_id?: unknown;
};

type CreditOrderRow = {
  id: string;
  order_no: string;
  package_name: string;
  credits_amount: number;
  price_amount: number;
  currency: string;
  status: CreditOrderStatus;
  provider: PaymentProvider | null;
  checkout_url: string | null;
  idempotency_key: string | null;
  created_at: string;
};

const PLACEHOLDER_PROVIDER = "placeholder" satisfies PaymentProvider;
const orderSelectFields =
  "id,order_no,package_name,credits_amount,price_amount,currency,status,provider,checkout_url,idempotency_key,created_at";

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function createOrderNo() {
  const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();

  return `NF-${Date.now()}-${randomPart}`;
}

function createPlaceholderIdempotencyKey(packageId: string) {
  const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

  return `${PLACEHOLDER_PROVIDER}:${packageId}:${randomPart}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateCreditOrderBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("创建点数订单时不能从前端传 user_id。");
  }

  const packageId = typeof body.packageId === "string" ? body.packageId.trim() : "";
  const creditPackage = getCreditPackage(packageId);

  if (!creditPackage) {
    return validationError("未知点数包。");
  }

  const idempotencyKey = createPlaceholderIdempotencyKey(creditPackage.packageId);
  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("credit_orders")
    .select(orderSelectFields)
    .eq("user_id", user.id)
    .eq("provider", PLACEHOLDER_PROVIDER)
    .eq("package_name", creditPackage.packageId)
    .eq("status", "pending")
    .maybeSingle<CreditOrderRow>();

  if (existingOrderError) {
    return serverError(existingOrderError.message);
  }

  if (existingOrder) {
    return NextResponse.json({
      order: existingOrder,
      reused: true,
      message: "已返回现有 pending 占位订单。支付尚未接入，不会增加点数余额。",
    });
  }

  const { data: order, error: orderError } = await supabase
    .from("credit_orders")
    .insert({
      order_no: createOrderNo(),
      package_name: creditPackage.packageId,
      credits_amount: creditPackage.creditsAmount,
      price_amount: creditPackage.priceAmount,
      currency: creditPackage.currency,
      status: "pending",
      provider: PLACEHOLDER_PROVIDER,
      checkout_url: null,
      idempotency_key: idempotencyKey,
    })
    .select(orderSelectFields)
    .single<CreditOrderRow>();

  if (orderError || !order) {
    const { data: racedOrder, error: racedOrderError } = await supabase
      .from("credit_orders")
      .select(orderSelectFields)
      .eq("user_id", user.id)
      .eq("provider", PLACEHOLDER_PROVIDER)
      .eq("package_name", creditPackage.packageId)
      .eq("status", "pending")
      .maybeSingle<CreditOrderRow>();

    if (racedOrder) {
      return NextResponse.json({
        order: racedOrder,
        reused: true,
        message: "已返回现有 pending 占位订单。支付尚未接入，不会增加点数余额。",
      });
    }

    return serverError(racedOrderError?.message || orderError?.message || "点数订单创建失败。");
  }

  return NextResponse.json({
    order,
    message: "支付尚未接入，订单已作为占位记录创建，不会增加点数余额。",
  });
}
