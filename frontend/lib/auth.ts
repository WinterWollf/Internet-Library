"use server";

import { cookies } from "next/headers";

const IS_PROD = process.env.NODE_ENV === "production";

const BASE = {
  secure: IS_PROD,
  sameSite: "strict" as const,
  path: "/",
} as const;


/**
 * Persist access and refresh tokens as cookies after a successful login or token refresh.
 * Must be called from a Server Action or Route Handler (uses next/headers).
 */
export async function setTokens(
  access: string,
  refresh: string,
): Promise<void> {
  const store = await cookies();
  // httpOnly: false — access_token must be readable by api.ts in the browser to attach
  // the Authorization header. Lifetime matches the backend ACCESS_TOKEN_LIFETIME (60 min
  // by default; the short 15 min here means the cookie is cleaned up faster on the client).
  store.set("access_token", access, {
    ...BASE,
    httpOnly: false,
    maxAge: 15 * 60,
  });
  // httpOnly: true — refresh_token is never accessible from JS; only sent by the browser
  // to the Next.js /api/auth/refresh route handler which proxies it to Django.
  store.set("refresh_token", refresh, {
    ...BASE,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
  });
}

/** Delete both auth cookies, effectively logging the user out on the server side. */
export async function clearTokens(): Promise<void> {
  const store = await cookies();
  store.delete("access_token");
  store.delete("refresh_token");
}

/** Return the raw access_token string from the server-side cookie store, or undefined if absent. */
export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("access_token")?.value;
}

/** Return the raw refresh_token string (httpOnly cookie). Only accessible server-side. */
export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get("refresh_token")?.value;
}

// Decodes the JWT payload without verifying the signature — safe here because the token
// was issued by our own backend and is read from a server-side cookie, not user input.
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

/**
 * Decode the access token and return the embedded user identity claims.
 * Returns null if no token is present. Does not make a network call.
 */
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

// Presence check only — does not validate expiry. Expired tokens are caught by api.ts on
// the next request and trigger a refresh or redirect to /login.
export async function isAuthenticated(): Promise<boolean> {
  return !!(await getAccessToken());
}

/** Return true if the current user's role claim is "admin". */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/** Return true if the current user's role claim is "reader". */
export async function isReader(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "reader";
}
