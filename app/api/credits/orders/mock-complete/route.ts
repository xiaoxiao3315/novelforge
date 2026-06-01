import { NextResponse } from "next/server";
import {
  isMockPaymentEnabled,
  isMockPaymentResult,
} from "@/lib/payments/mock";
import type { CreditOrderStatus } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

type MockCompleteBody = {
  orderId?: unknown;
  orderNo?: unknown;
  result?: unknown;
  user_id?: unknown;
  creditsAmount?: unknown;
  priceAmount?: unknown;
};

type MockCompleteRow = {
  order_id: string;
  order_no: string;
  status: CreditOrderStatus;
  credit_transaction_id: string | null;
  balance_after: number | null;
};

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflictError(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  if (!isMockPaymentEnabled()) {
    return NextResponse.json({ error: "Mock 支付仅允许在非生产环境使用。" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as MockCompleteBody | null;

  if (!body || typeof body !== "object") {
    return validationError("请求格式不正确。");
  }

  if ("user_id" in body) {
    return validationError("Mock 支付时不能从前端传 user_id。");
  }

  if ("creditsAmount" in body || "priceAmount" in body) {
    return validationError("Mock 支付不接受前端传入价格或点数。");
  }

  if (!isMockPaymentResult(body.result)) {
    return validationError("未知 Mock 支付结果。");
  }

  const orderId = typeof body.orderId === "string" && body.orderId ? body.orderId : null;
  const orderNo = typeof body.orderNo === "string" && body.orderNo ? body.orderNo : null;

  if (!orderId && !orderNo) {
    return validationError("缺少订单标识。");
  }

  const { data, error } = await supabase.rpc("mock_complete_credit_order", {
    p_order_id: orderId,
    p_order_no: orderNo,
    p_result: body.result,
  });

  if (error) {
    const message = error.message || "Mock 支付处理失败。";

    if (
      message.includes("order is not pending") ||
      message.includes("order not found") ||
      message.includes("unsupported mock payment result")
    ) {
      return conflictError(message);
    }

    return serverError(message);
  }

  const row = Array.isArray(data) ? (data[0] as MockCompleteRow | undefined) : undefined;

  if (!row) {
    return serverError("Mock 支付处理没有返回订单结果。");
  }

  return NextResponse.json({
    order: {
      id: row.order_id,
      orderNo: row.order_no,
      status: row.status,
      creditTransactionId: row.credit_transaction_id,
    },
    balanceAfter: row.balance_after,
    message:
      body.result === "success"
        ? "Mock 支付成功，点数已入账。"
        : body.result === "failed"
          ? "Mock 支付失败，未增加余额。"
          : "Mock 支付已取消，未增加余额。",
  });
}
