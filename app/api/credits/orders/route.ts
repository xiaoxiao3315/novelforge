import { NextResponse } from "next/server";
import { CREDIT_PACKAGES, type CreditPackageName } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

type CreateCreditOrderBody = {
  packageName?: unknown;
  user_id?: unknown;
};

type CreditOrderRow = {
  id: string;
  order_no: string;
  package_name: string;
  credits_amount: number;
  price_amount: number;
  currency: string;
  status: string;
  created_at: string;
};

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

  const packageName =
    typeof body.packageName === "string" ? (body.packageName.trim() as CreditPackageName) : "";
  const creditPackage = CREDIT_PACKAGES.find((item) => item.packageName === packageName);

  if (!creditPackage) {
    return validationError("未知点数包。");
  }

  const { data: order, error: orderError } = await supabase
    .from("credit_orders")
    .insert({
      order_no: createOrderNo(),
      package_name: creditPackage.packageName,
      credits_amount: creditPackage.creditsAmount,
      price_amount: creditPackage.priceAmount,
      currency: creditPackage.currency,
      status: "pending",
    })
    .select("id,order_no,package_name,credits_amount,price_amount,currency,status,created_at")
    .single<CreditOrderRow>();

  if (orderError || !order) {
    return serverError(orderError?.message || "点数订单创建失败。");
  }

  return NextResponse.json({
    order,
    message: "支付尚未接入，订单已作为占位记录创建，不会增加点数余额。",
  });
}
