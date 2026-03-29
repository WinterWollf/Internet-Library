/**
 * Tests for the Next.js middleware route protection logic.
 *
 * We test the middleware function directly using mock NextRequest objects.
 * next/server is available in the jsdom environment via Next.js types.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "../../proxy";

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  return `${header}.${body}.sig`;
}

function makeRequest(
  pathname: string,
  options: { accessToken?: string } = {},
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const req = new NextRequest(url);
  if (options.accessToken) {
    req.cookies.set("access_token", options.accessToken);
  }
  return req;
}

const readerToken = makeJwt({ user_id: 2, role: "reader" });
const adminToken = makeJwt({ user_id: 1, role: "admin" });

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Public routes — no auth required", () => {
  it.each(["/", "/catalog", "/catalog/123", "/login", "/register"])(
    "allows unauthenticated access to %s",
    (path) => {
      const res = middleware(makeRequest(path));
      expect(res.status).not.toBe(307);
    },
  );
});

describe("Authenticated user on /login or /register", () => {
  it("redirects to /catalog from /login", () => {
    const res = middleware(makeRequest("/login", { accessToken: readerToken }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/catalog");
  });

  it("redirects to /catalog from /register", () => {
    const res = middleware(
      makeRequest("/register", { accessToken: readerToken }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/catalog");
  });
});

describe("Reader routes — require authentication", () => {
  it.each(["/loans", "/account", "/notifications"])(
    "redirects unauthenticated user from %s to /login",
    (path) => {
      const res = middleware(makeRequest(path));
      expect(res.status).toBe(307);
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("/login");
      expect(location).toContain(encodeURIComponent(path));
    },
  );

  it("allows authenticated reader through /loans", () => {
    const res = middleware(
      makeRequest("/loans", { accessToken: readerToken }),
    );
    expect(res.status).not.toBe(307);
  });
});

describe("Admin routes — require admin role", () => {
  it("redirects unauthenticated user from /admin to /login", () => {
    const res = middleware(makeRequest("/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects reader role from /admin to /catalog with error", () => {
    const res = middleware(
      makeRequest("/admin", { accessToken: readerToken }),
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/catalog");
    expect(location).toContain("error=unauthorized");
  });

  it("allows admin role through /admin", () => {
    const res = middleware(makeRequest("/admin", { accessToken: adminToken }));
    expect(res.status).not.toBe(307);
  });
});

describe("Static / API routes are skipped", () => {
  it.each(["/_next/static/chunk.js", "/api/auth/refresh", "/favicon.ico"])(
    "passes through %s without redirect",
    (path) => {
      const res = middleware(makeRequest(path));
      expect(res.status).not.toBe(307);
    },
  );
});
