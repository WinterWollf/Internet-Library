"use server";

/**
 * Server-side auth helpers.
 * All functions use next/headers cookies() and run as server actions.
 *
 * Cookie strategy:
 *   access_token  — httpOnly: false so client-side JS can read it for the
 *                   Authorization header. Short-lived (15 min).
 *   refresh_token — httpOnly: true for XSS protection. Long-lived (7 days).
 *                   Only readable server-side; client refreshes via
 *                   the /api/auth/refresh route handler.
 */

import { cookies } from "next/headers";

const IS_PROD = process.env.NODE_ENV === "production";

const BASE = {
  secure: IS_PROD,
  sameSite: "strict" as const,
  path: "/",
} as const;

// ── Cookie setters / clearers ─────────────────────────────────────────────────

export async function setTokens(
  access: string,
  refresh: string,
): Promise<void> {
  const store = await cookies();
  store.set("access_token", access, {
    ...BASE,
    httpOnly: false,  // Must be readable by client JS for Authorization header
    maxAge: 15 * 60,
  });
  store.set("refresh_token", refresh, {
    ...BASE,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearTokens(): Promise<void> {
  const store = await cookies();
  store.delete("access_token");
  store.delete("refresh_token");
}

// ── Token readers ─────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("access_token")?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("refresh_token")?.value;
}

// ── JWT decoding ──────────────────────────────────────────────────────────────

function decodePayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    // Buffer is available in Node.js / Edge runtime
    const decoded = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<{
  id: number;
  email: string;
  role: "reader" | "admin";
} | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const payload = decodePayload(token);
  const id = payload.user_id ?? payload.sub;
  if (!id) return null;
  return {
    id: id as number,
    email: (payload.email ?? "") as string,
    role: ((payload.role ?? "reader") as "reader" | "admin"),
  };
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getAccessToken());
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

export async function isReader(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "reader";
}
