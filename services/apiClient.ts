import { buildApiUrl } from "@/lib/env";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiResponseEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
};

let refreshPromise: Promise<string | null> | null = null;

export function storeAuthTokens(accessToken: string, refreshToken?: string | null, rememberDevice = false) {
  void accessToken;
  void refreshToken;
  void rememberDevice;
}

export function clearStoredAuth() {
  return;
}

async function parseApiResponse<TResponse>(response: Response): Promise<TResponse> {
  const payload = (await response.json()) as ApiResponseEnvelope<TResponse>;

  if (!response.ok || payload?.success === false) {
    const message = payload?.message ?? "Request failed";
    throw new ApiError(message, response.status);
  }

  return (payload?.data ?? payload) as TResponse;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(buildApiUrl("/api/v1/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const payload = await parseApiResponse<LoginResponse>(response);
        return payload.accessToken ?? "refreshed";
      } catch {
        clearStoredAuth();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function apiRequest<TResponse>(
  path: string,
  init: RequestInit,
  retryOnUnauthorized = true,
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });

  if (response.status === 401 && retryOnUnauthorized && path !== "/api/v1/auth/refresh") {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiRequest<TResponse>(path, init, false);
    }
  }

  return parseApiResponse<TResponse>(response);
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  init?: RequestInit,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export async function apiGet<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    ...init,
    method: "GET",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
}

export async function apiPut<TResponse, TBody>(
  path: string,
  body: TBody,
  init?: RequestInit,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    ...init,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  return apiRequest<TResponse>(path, {
    ...init,
    method: "DELETE",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
}
