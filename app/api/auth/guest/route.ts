import { NextResponse } from "next/server";
import { setInternalSession } from "@/lib/internal/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true, mode: "internal" });
  setInternalSession(response);
  return response;
}
