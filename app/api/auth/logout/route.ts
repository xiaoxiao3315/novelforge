import { NextResponse } from "next/server";
import { clearInternalSession, isInternalAuthEnabled } from "@/lib/internal/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearInternalSession(response);

  if (isInternalAuthEnabled()) {
    return response;
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Internal mode does not require a Supabase session.
  }

  return response;
}
