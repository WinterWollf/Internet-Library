/**
 * POST /api/auth/refresh
 *
 * Client-side token refresh proxy.
 * Reads the httpOnly refresh_token cookie (inaccessible to browser JS),
 * calls Django's token/refresh endpoint, and sets new cookies on the response.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Server-side route handler — must use the internal Docker hostname, not localhost
const DJANGO_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000/api/v1";

const IS_PROD = process.env.NODE_ENV === "production";

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const djangoRes = await fetch(`${DJANGO_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!djangoRes.ok) {
    const response = NextResponse.json(
      { error: "Token refresh failed" },
      { status: 401 },
    );
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    return response;
  }

  const data = (await djangoRes.json()) as { access: string; refresh?: string };

  const base = {
    secure: IS_PROD,
    sameSite: "strict" as const,
    path: "/",
  };

  const response = NextResponse.json({ access: data.access });
  response.cookies.set("access_token", data.access, {
    ...base,
    httpOnly: false,
    maxAge: 15 * 60,
  });
  if (data.refresh) {
    response.cookies.set("refresh_token", data.refresh, {
      ...base,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}
