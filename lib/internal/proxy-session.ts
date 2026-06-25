import { NextResponse, type NextRequest } from "next/server";
import { requestHasInternalSession } from "@/lib/internal/auth";

const protectedRoutes = ["/dashboard", "/create", "/project", "/account"];
const authRoutes = ["/login"];

function startsWithRoute(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasInternalAuth = requestHasInternalSession(request);

  if (!hasInternalAuth && startsWithRoute(pathname, protectedRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (hasInternalAuth && startsWithRoute(pathname, authRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

