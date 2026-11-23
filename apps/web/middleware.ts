import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = new Set(["/login", "/forgot-password", "/reset-password"]);

function isJwtUnexpired(rawCookie: string | undefined): boolean {
  if (!rawCookie) return false;
  try {
    const token = decodeURIComponent(rawCookie);
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number; sub?: number };
    if (!payload?.sub) return false;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function buildSafeNextParam(pathname: string, search: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  if (PUBLIC_AUTH_ROUTES.has(pathname) || pathname === "/change-password") return null;
  return search ? `${pathname}${search}` : pathname;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get("erp_auth_token")?.value;
  const hasValidToken = isJwtUnexpired(rawToken);
  const isPublic = PUBLIC_AUTH_ROUTES.has(pathname);

  if (!hasValidToken && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const safeNext = buildSafeNextParam(pathname, search);
    if (safeNext) {
      loginUrl.searchParams.set("next", safeNext);
    }
    if (rawToken) {
      loginUrl.searchParams.set("expired", "1");
    }
    const response = NextResponse.redirect(loginUrl);
    if (rawToken) {
      response.cookies.delete("erp_auth_token");
      response.cookies.delete("erp_user_id");
    }
    return response;
  }

  if (hasValidToken && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
