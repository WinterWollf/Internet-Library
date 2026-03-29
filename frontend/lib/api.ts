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

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
