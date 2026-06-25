import { NextResponse } from "next/server";
import { clearInternalSession } from "@/lib/internal/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearInternalSession(response);
  return response;
}
