import { apiDelete, apiGet, apiPost, apiPut } from "@/services/apiClient";
import type {
  AlertSilence,
  AlertPolicy,
  EffectiveAlertPolicy,
  TenantNotificationSettings,
  UpsertAlertSilenceInput,
  UpsertAlertPolicyInput,
  UpsertTenantNotificationSettingsInput,
} from "@/types/alerting";

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function getTenantNotificationSettings(
  accessToken: string,
  tenantId: string,
): Promise<TenantNotificationSettings> {
  return apiGet<TenantNotificationSettings>(`/api/v1/notification-settings/tenants/${tenantId}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function saveTenantNotificationSettings(
  accessToken: string,
  tenantId: string,
  payload: UpsertTenantNotificationSettingsInput,
): Promise<TenantNotificationSettings> {
  return apiPut<TenantNotificationSettings, UpsertTenantNotificationSettingsInput>(
    `/api/v1/notification-settings/tenants/${tenantId}`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function testTenantTelegramRouting(
  accessToken: string,
  tenantId: string,
  payload: UpsertTenantNotificationSettingsInput,
): Promise<void> {
  await apiPost<void, UpsertTenantNotificationSettingsInput>(
    `/api/v1/notification-settings/tenants/${tenantId}/telegram/test`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function getGlobalAlertPolicy(accessToken: string): Promise<AlertPolicy> {
  return apiGet<AlertPolicy>("/api/v1/alert-policies/global", {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function saveGlobalAlertPolicy(accessToken: string, payload: UpsertAlertPolicyInput): Promise<AlertPolicy> {
  return apiPut<AlertPolicy, UpsertAlertPolicyInput>("/api/v1/alert-policies/global", payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getTenantAlertPolicy(accessToken: string, tenantId: string): Promise<AlertPolicy> {
  return apiGet<AlertPolicy>(`/api/v1/alert-policies/tenants/${tenantId}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function saveTenantAlertPolicy(
  accessToken: string,
  tenantId: string,
  payload: UpsertAlertPolicyInput,
): Promise<AlertPolicy> {
  return apiPut<AlertPolicy, UpsertAlertPolicyInput>(`/api/v1/alert-policies/tenants/${tenantId}`, payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getServerAlertPolicy(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<AlertPolicy> {
  return apiGet<AlertPolicy>(`/api/v1/alert-policies/tenants/${tenantId}/servers/${serverId}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function saveServerAlertPolicy(
  accessToken: string,
  tenantId: string,
  serverId: string,
  payload: UpsertAlertPolicyInput,
): Promise<AlertPolicy> {
  return apiPut<AlertPolicy, UpsertAlertPolicyInput>(
    `/api/v1/alert-policies/tenants/${tenantId}/servers/${serverId}`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function getEffectiveAlertPolicy(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<EffectiveAlertPolicy> {
  return apiGet<EffectiveAlertPolicy>(`/api/v1/alert-policies/tenants/${tenantId}/servers/${serverId}/effective`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function listAlertSilences(
  accessToken: string,
  tenantId: string,
  options?: {
    serverId?: string;
    scope?: "all" | "tenant" | "server";
    activeOnly?: boolean;
  },
): Promise<AlertSilence[]> {
  const searchParams = new URLSearchParams();
  if (options?.serverId) {
    searchParams.set("serverId", options.serverId);
  }
  if (options?.scope) {
    searchParams.set("scope", options.scope);
  }
  if (typeof options?.activeOnly === "boolean") {
    searchParams.set("activeOnly", String(options.activeOnly));
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/api/v1/alert-silences/tenants/${tenantId}?${queryString}`
    : `/api/v1/alert-silences/tenants/${tenantId}`;

  return apiGet<AlertSilence[]>(path, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function createAlertSilence(
  accessToken: string,
  tenantId: string,
  payload: UpsertAlertSilenceInput,
): Promise<AlertSilence> {
  return apiPost<AlertSilence, UpsertAlertSilenceInput>(`/api/v1/alert-silences/tenants/${tenantId}`, payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function deleteAlertSilence(accessToken: string, tenantId: string, silenceId: string): Promise<void> {
  await apiDelete<void>(`/api/v1/alert-silences/tenants/${tenantId}/${silenceId}`, {
    headers: buildAuthHeaders(accessToken),
  });
}
