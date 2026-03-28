import api from "./api";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/api/v1/auth/login/", credentials);
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/api/v1/auth/logout/");
}

export async function refreshToken(refresh: string): Promise<Pick<AuthTokens, "access">> {
  const { data } = await api.post<Pick<AuthTokens, "access">>("/api/v1/auth/token/refresh/", { refresh });
  return data;
}
