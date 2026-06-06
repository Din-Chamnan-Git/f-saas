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

type CsrfResponse = {
  csrfToken: string;
};

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-XSRF-TOKEN";

let refreshPromise: Promise<string | null> | null = null;

export function storeAuthTokens(accessToken: string, refreshToken?: string | null, rememberDevice = false) {
  void accessToken;
  void refreshToken;
  void rememberDevice;
}

export function clearStoredAuth() {
  return;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readCookieValue(name: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }

    return decodeURIComponent(trimmed.substring(name.length + 1));
  }

  return null;
}

function isMutatingMethod(method: string | undefined): boolean {
  const normalized = (method ?? "GET").toUpperCase();
  return normalized === "POST" || normalized === "PUT" || normalized === "PATCH" || normalized === "DELETE";
}

async function ensureCsrfToken(): Promise<string | null> {
  if (!isBrowser()) {
    return null;
  }

  const existing = readCookieValue(CSRF_COOKIE_NAME);
  if (existing) {
    return existing;
  }

  try {
    const response = await fetch(buildApiUrl("/api/v1/security/csrf"), {
      method: "GET",
      credentials: "include",
    });
    const payload = await parseApiResponse<CsrfResponse>(response);
    return payload.csrfToken ?? readCookieValue(CSRF_COOKIE_NAME);
  } catch {
    return readCookieValue(CSRF_COOKIE_NAME);
  }
}

async function prepareRequestInit(path: string, init: RequestInit): Promise<RequestInit> {
  if (!isMutatingMethod(init.method) || path === "/api/v1/security/csrf") {
    return init;
  }

  const headers = new Headers(init.headers);
  const csrfToken = await ensureCsrfToken();
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return {
    ...init,
    headers,
  };
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
        const requestInit = await prepareRequestInit("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const response = await fetch(buildApiUrl("/api/v1/auth/refresh"), {
          ...requestInit,
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
  const preparedInit = await prepareRequestInit(path, init);
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...preparedInit,
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
