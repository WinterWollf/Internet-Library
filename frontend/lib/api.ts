/**
 * Universal typed HTTP client using fetch.
 *
 * Server-side: reads access_token from next/headers cookies and attaches
 *   the Authorization: Bearer header.
 * Client-side: reads access_token from document.cookie (non-httpOnly) and
 *   attaches the Authorization: Bearer header.
 *
 * On 401:
 *   Server-side — reads refresh_token from next/headers cookies, calls
 *     Django's token/refresh endpoint directly, retries the original request.
 *   Client-side — calls /api/auth/refresh (Next.js route handler) which reads
 *     the httpOnly refresh_token and proxies to Django, retries once.
 *
 * On second 401 (refresh failed): clears cookies and redirects to /login.
 */

import { ApiError } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ── Cookie helpers ────────────────────────────────────────────────────────────

/** Read the access_token cookie from next/headers (SSR) or document.cookie (browser). */
async function readAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") {
    // Server-side: use next/headers
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return store.get("access_token")?.value;
  }
  // Client-side: access_token is non-httpOnly
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * SSR: calls Django's token/refresh directly and writes the new tokens via setTokens.
 * Browser: delegates to the Next.js /api/auth/refresh route handler (reads httpOnly cookie).
 * Returns true on success, false if the refresh token is absent or rejected.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") {
    // Server-side: read httpOnly refresh_token and call Django directly
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const refreshToken = store.get("refresh_token")?.value;
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { access: string; refresh?: string };
    const { setTokens } = await import("./auth");
    await setTokens(data.access, data.refresh ?? refreshToken);
    return true;
  }

  // Client-side: delegate to the Next.js route handler (reads httpOnly cookie)
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

// ── Error parsing ─────────────────────────────────────────────────────────────

/** Parse a non-OK response into an ApiError, reading `error`, `code`, or `detail` from the JSON body. */
async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: string; code?: string; detail?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* empty body */
  }
  return new ApiError(
    res.status,
    body.code ?? "UNKNOWN_ERROR",
    body.error ?? body.detail ?? res.statusText,
  );
}

// ── Core request function ─────────────────────────────────────────────────────

// isRetry prevents infinite loops: on a second 401 we clear tokens and redirect instead
// of trying to refresh again.
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const accessToken = await readAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return request<T>(method, path, body, true);
    }

    // Refresh failed — clear tokens and redirect to login
    if (typeof window !== "undefined") {
      // Client-side: clear non-httpOnly access_token directly
      document.cookie =
        "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
    } else {
      // Server-side: import and call clearTokens
      const { clearTokens } = await import("./auth");
      await clearTokens();
    }
    throw await parseError(res);
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Send a GET request; returns the parsed JSON body typed as T. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

/** Send a POST request with an optional JSON body; returns the parsed response typed as T. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

/** Send a PATCH request with an optional partial JSON body; returns the updated resource typed as T. */
export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

/** Send a DELETE request; body is optional (e.g. for wishlist removal by book_id). Returns T (often void). */
export function apiDelete<T = void>(path: string, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}
