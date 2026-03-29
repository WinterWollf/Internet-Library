/**
 * Tests for JWT decoding in getCurrentUser and server-side cookie helpers.
 *
 * Because auth.ts is a 'use server' module that uses next/headers, we mock
 * that dependency and test the observable behaviour: reading / writing cookies
 * and decoding JWT payloads correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── JWT fixture helpers ───────────────────────────────────────────────────────

function base64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  return `${header}.${body}.signature`;
}

// ── Mock next/headers ─────────────────────────────────────────────────────────

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no access_token cookie", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const { getCurrentUser } = await import("../auth");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("decodes user_id, email, and role from JWT payload", async () => {
    const token = makeJwt({ user_id: 42, email: "alice@example.com", role: "reader" });
    mockCookieStore.get.mockReturnValue({ value: token });

    const { getCurrentUser } = await import("../auth");
    const user = await getCurrentUser();

    expect(user).toEqual({ id: 42, email: "alice@example.com", role: "reader" });
  });

  it("defaults role to reader when not present in payload", async () => {
    const token = makeJwt({ user_id: 7, email: "bob@example.com" });
    mockCookieStore.get.mockReturnValue({ value: token });

    const { getCurrentUser } = await import("../auth");
    const user = await getCurrentUser();

    expect(user?.role).toBe("reader");
  });

  it("reads admin role correctly", async () => {
    const token = makeJwt({ user_id: 1, email: "admin@example.com", role: "admin" });
    mockCookieStore.get.mockReturnValue({ value: token });

    const { getCurrentUser } = await import("../auth");
    const user = await getCurrentUser();

    expect(user?.role).toBe("admin");
  });

  it("returns null for a malformed token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt.at.all" });
    const { getCurrentUser } = await import("../auth");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

describe("isAuthenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when access_token exists", async () => {
    mockCookieStore.get.mockReturnValue({ value: "some-token" });
    const { isAuthenticated } = await import("../auth");
    expect(await isAuthenticated()).toBe(true);
  });

  it("returns false when no access_token", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const { isAuthenticated } = await import("../auth");
    expect(await isAuthenticated()).toBe(false);
  });
});

describe("isAdmin / isReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isAdmin returns true for admin role", async () => {
    const token = makeJwt({ user_id: 1, email: "a@b.com", role: "admin" });
    mockCookieStore.get.mockReturnValue({ value: token });
    const { isAdmin } = await import("../auth");
    expect(await isAdmin()).toBe(true);
  });

  it("isAdmin returns false for reader role", async () => {
    const token = makeJwt({ user_id: 2, email: "a@b.com", role: "reader" });
    mockCookieStore.get.mockReturnValue({ value: token });
    const { isAdmin } = await import("../auth");
    expect(await isAdmin()).toBe(false);
  });

  it("isReader returns true for reader role", async () => {
    const token = makeJwt({ user_id: 3, email: "a@b.com", role: "reader" });
    mockCookieStore.get.mockReturnValue({ value: token });
    const { isReader } = await import("../auth");
    expect(await isReader()).toBe(true);
  });
});

describe("setTokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets access_token as non-httpOnly and refresh_token as httpOnly", async () => {
    const { setTokens } = await import("../auth");
    await setTokens("acc", "ref");

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);

    const [accessCall, refreshCall] = mockCookieStore.set.mock.calls as [
      [string, string, Record<string, unknown>],
      [string, string, Record<string, unknown>],
    ];

    expect(accessCall[0]).toBe("access_token");
    expect(accessCall[2].httpOnly).toBe(false);

    expect(refreshCall[0]).toBe("refresh_token");
    expect(refreshCall[2].httpOnly).toBe(true);
  });
});

describe("clearTokens", () => {
  it("deletes both cookies", async () => {
    const { clearTokens } = await import("../auth");
    await clearTokens();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("access_token");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("refresh_token");
  });
});
