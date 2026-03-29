import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require no authentication
const PUBLIC_PATHS = new Set(["/", "/catalog", "/login", "/register"]);

// Routes that require authentication (any role)
const READER_PREFIXES = ["/loans", "/account", "/notifications"];

// Routes that require admin role
const ADMIN_PREFIXES = ["/admin"];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // atob is available in the Edge runtime
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals, static assets, and our own API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    /\.(.+)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const isAuthed = !!accessToken;

  let role: string | null = null;
  if (accessToken) {
    const payload = decodeJwtPayload(accessToken);
    role = (payload?.role as string) ?? "reader";
  }

  // Authenticated users should not see login/register
  if (isAuthed && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/catalog", request.url));
  }

  // Public routes (exact match) — also allow /catalog/* sub-paths
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/catalog/")
  ) {
    return NextResponse.next();
  }

  // Admin routes — require auth + admin role
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isAuthed) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (role !== "admin") {
      const url = new URL("/catalog", request.url);
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Reader routes — require auth (any role)
  if (READER_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isAuthed) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
