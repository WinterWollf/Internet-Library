"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { setTokens, clearTokens } from "./auth";
import type { LoginResponse, RegisterPayload, User } from "./types";

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: () => boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  mfaToken: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function readCookieClient(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function throwOnError(res: Response) {
  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    // DRF can return either { error, code } or field-level { field: [msg, ...] }
    const topLevel =
      (body.error as string | undefined) ??
      (body.detail as string | undefined);

    const fieldMessage = topLevel == null
      ? Object.entries(body)
          .filter(([k]) => k !== "code")
          .map(([field, msgs]) => {
            const text = Array.isArray(msgs) ? msgs[0] : String(msgs);
            return `${field}: ${text}`;
          })
          .join(" · ")
      : undefined;

    const err = Object.assign(
      new Error(topLevel ?? fieldMessage ?? res.statusText),
      { status: res.status, code: (body.code as string | undefined) ?? "UNKNOWN_ERROR" },
    );
    throw err;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  // On mount: if access_token exists, hydrate user state from /auth/profile/
  useEffect(() => {
    const token = readCookieClient("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch(`${API}/auth/profile/`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {
        /* treat as unauthenticated */
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse> => {
      const res = await fetch(`${API}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      await throwOnError(res);
      const data = (await res.json()) as LoginResponse;
      if (data.mfa_required) {
        setMfaToken(data.mfa_token ?? null);
      } else {
        await setTokens(data.access, data.refresh);
        setUser(data.user);
      }
      return data;
    },
    [],
  );

  const logout = useCallback(async () => {
    const token = readCookieClient("access_token");
    try {
      await fetch(`${API}/auth/logout/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
    } catch {
      /* best-effort */
    }
    await clearTokens();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    const res = await fetch(`${API}/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    await throwOnError(res);
    const result = (await res.json()) as LoginResponse;
    await setTokens(result.access, result.refresh);
    setUser(result.user);
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    const res = await fetch(`${API}/auth/mfa/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa_token: mfaToken, code }),
      credentials: "include",
    });
    await throwOnError(res);
    const result = (await res.json()) as LoginResponse;
    setMfaToken(null);
    await setTokens(result.access, result.refresh);
    setUser(result.user);
  }, [mfaToken]);

  const isAdmin = useCallback(() => user?.role === "admin", [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        logout,
        register,
        verifyMfa,
        mfaToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
