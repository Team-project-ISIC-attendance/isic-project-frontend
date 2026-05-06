import type { components } from "./schema";

type TokenResponse = components["schemas"]["TokenResponse"];
export type AuthUserResponse = components["schemas"]["UserResponse"] & {
  isic_identifier: string | null;
};
export interface RegisterTeacherInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  isic_identifier: string;
  role?: "teacher";
}

export interface TeacherUpdateInput {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  isic_identifier?: string | null;
}

const API_URL = import.meta.env.VITE_API_URL as string;

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errorBody = (await response.json()) as { detail?: string };
      throw new Error(errorBody.detail || `HTTP ${response.status}`);
    }

    const errorBody = await response.text();
    throw new Error(errorBody || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({ username: email, password });

  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error("Invalid credentials");
  }

  return response.json() as Promise<TokenResponse>;
}

export async function getMe(): Promise<AuthUserResponse> {
  return apiFetch<AuthUserResponse>("/auth/me");
}

export async function updateMyIsic(
  isicIdentifier: string | null,
): Promise<AuthUserResponse> {
  return apiFetch<AuthUserResponse>("/auth/me/isic", {
    method: "PATCH",
    body: JSON.stringify({ isic_identifier: isicIdentifier }),
  });
}

export async function registerTeacher(
  payload: RegisterTeacherInput,
): Promise<AuthUserResponse> {
  return apiFetch<AuthUserResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      role: payload.role ?? "teacher",
    }),
  });
}

export async function listTeachers(): Promise<AuthUserResponse[]> {
  return apiFetch<AuthUserResponse[]>("/auth/teachers");
}

export async function updateTeacher(
  userId: number,
  payload: TeacherUpdateInput,
): Promise<AuthUserResponse> {
  return apiFetch<AuthUserResponse>(`/auth/teachers/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTeacher(userId: number): Promise<void> {
  return apiFetch<void>(`/auth/teachers/${userId}`, {
    method: "DELETE",
  });
}
