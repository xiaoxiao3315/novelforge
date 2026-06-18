import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const INTERNAL_AUTH_COOKIE = "nf_internal_session";
export const INTERNAL_USER_ID = "internal-user";

const COOKIE_VALUE = "1";

export function isInternalAuthEnabled() {
  return process.env.INTERNAL_AUTH_ENABLED === "true";
}

export async function hasInternalSession() {
  if (!isInternalAuthEnabled()) {
    return false;
  }

  const cookieStore = await cookies();
  return cookieStore.get(INTERNAL_AUTH_COOKIE)?.value === COOKIE_VALUE;
}

export function requestHasInternalSession(request: NextRequest) {
  return (
    isInternalAuthEnabled() &&
    request.cookies.get(INTERNAL_AUTH_COOKIE)?.value === COOKIE_VALUE
  );
}

export function setInternalSession(response: NextResponse) {
  response.cookies.set(INTERNAL_AUTH_COOKIE, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function clearInternalSession(response: NextResponse) {
  response.cookies.set(INTERNAL_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
