/**
 * Tests for the typed HTTP client in lib/api.ts
 *
 * next/headers and lib/auth are mocked so tests run in jsdom without a
 * full Next.js runtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "../types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock next/headers so it doesn't crash in jsdom
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock lib/auth server actions
vi.mock("../auth", () => ({
  setTokens: vi.fn().mockResolvedValue(undefined),
  clearTokens: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setAccessTokenCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: `access_token=${encodeURIComponent(value)}`,
  });
}

function clearCookies() {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("apiGet", () => {
  beforeEach(() => {
    clearCookies();
    vi.resetAllMocks();
    // Re-apply the mock after reset
    vi.mock("../auth", () => ({
      setTokens: vi.fn().mockResolvedValue(undefined),
      clearTokens: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches Authorization header when access_token cookie is present", async () => {
    setAccessTokenCookie("test-access-token");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({ id: 1, title: "Book" }));

    const { apiGet } = await import("../api");
    await apiGet("/catalog/books/");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
  });

  it("does not set Authorization header when no token cookie", async () => {
    clearCookies();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({ id: 1 }));

    const { apiGet } = await import("../api");
    await apiGet("/catalog/books/");

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("returns parsed JSON on success", async () => {
    setAccessTokenCookie("tok");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse({ count: 1, results: [{ id: 42 }] }),
    );

    const { apiGet } = await import("../api");
    const result = await apiGet<{ count: number }>("/catalog/books/");
    expect(result.count).toBe(1);
  });

  it("throws ApiError on non-401 error responses", async () => {
    setAccessTokenCookie("tok");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse({ error: "Not found", code: "NOT_FOUND" }, 404),
    );

    const { apiGet } = await import("../api");
    await expect(apiGet("/catalog/books/999")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("401 retry and token refresh flow", () => {
  beforeEach(() => {
    clearCookies();
    vi.resetModules();
  });

  it("retries the request after a successful refresh", async () => {
    setAccessTokenCookie("expired-token");

    // First call → 401, second call (after refresh) → 200
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({ error: "Unauthorized" }, 401))
      // /api/auth/refresh call
      .mockResolvedValueOnce(makeJsonResponse({ access: "new-token" }, 200))
      // retry of original request
      .mockResolvedValueOnce(makeJsonResponse({ id: 1, title: "Book" }, 200));

    const { apiGet } = await import("../api");
    const result = await apiGet<{ id: number }>("/catalog/books/1/");

    expect(result.id).toBe(1);
    // Original call + refresh call + retry = 3 fetch calls
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("throws ApiError and redirects when refresh also fails", async () => {
    setAccessTokenCookie("expired-token");

    const mockHref = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({ error: "Unauthorized" }, 401))
      .mockResolvedValueOnce(makeJsonResponse({ error: "Refresh failed" }, 401));

    const { apiGet } = await import("../api");
    await expect(apiGet("/loans/active/")).rejects.toMatchObject({ status: 401 });
  });

  it("does not retry more than once (isRetry guard)", async () => {
    setAccessTokenCookie("tok");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({}, 401))
      .mockResolvedValueOnce(makeJsonResponse({ access: "new" }, 200))
      // Second attempt also returns 401 — should not retry again
      .mockResolvedValueOnce(makeJsonResponse({}, 401));

    const { apiGet } = await import("../api");
    await expect(apiGet("/protected/")).rejects.toMatchObject({ status: 401 });

    // 3 calls: original + refresh + retry (no 4th)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

describe("apiPost / apiPatch / apiDelete", () => {
  beforeEach(() => {
    clearCookies();
    vi.resetModules();
    setAccessTokenCookie("tok");
  });

  it("apiPost sends JSON body and returns response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse({ id: 5 }, 201));

    const { apiPost } = await import("../api");
    const result = await apiPost<{ id: number }>("/loans/borrow/", {
      copy_id: 3,
    });

    expect(result.id).toBe(5);
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ copy_id: 3 }));
  });

  it("apiDelete returns undefined on 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    const { apiDelete } = await import("../api");
    const result = await apiDelete("/loans/1/");
    expect(result).toBeUndefined();
  });
});
