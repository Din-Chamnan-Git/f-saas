import { apiGet, apiPost, clearStoredAuth } from "@/services/apiClient";

export type UserRole = "admin" | "owner" | "member";

export type CurrentUser = {
  userId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
};

export async function getCurrentUser(_accessToken?: string): Promise<CurrentUser> {
  return apiGet<CurrentUser>("/api/v1/auth/me");
}

export async function logoutCurrentUser() {
  try {
    await apiPost<void, Record<string, never>>("/api/v1/auth/logout", {});
  } finally {
    clearStoredAuth();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiPost<void, { email: string }>("/api/v1/auth/forgot-password", {
    email,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiPost<void, { token: string; newPassword: string }>("/api/v1/auth/reset-password", {
    token,
    newPassword,
  });
}
