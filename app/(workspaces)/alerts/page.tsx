"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  createAlertSilence,
  deleteAlertSilence,
  getGlobalAlertPolicy,
  getServerAlertPolicy,
  listAlertSilences,
  getTenantAlertPolicy,
  getTenantNotificationSettings,
  saveGlobalAlertPolicy,
  saveServerAlertPolicy,
  saveTenantAlertPolicy,
  saveTenantNotificationSettings,
  testTenantTelegramRouting,
} from "@/services/alertingService";
import { listTenantServers, listTenants, type ServerResponse, type TenantResponse } from "@/services/workspaceService";
import type { AlertSilence, UpsertAlertPolicyInput, UpsertTenantNotificationSettingsInput } from "@/types/alerting";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Owners: "/owners",
  Tenants: "/tenants",
  Servers: "/servers",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
};

const EMPTY_POLICY: UpsertAlertPolicyInput = {
  cpuUsagePercent: null,
  memoryUsagePercent: null,
  diskFreePercent: null,
  serverDownForMinutes: null,
  containerDownForMinutes: null,
  containerRestartCount: null,
  resourceAlertWindowMinutes: 5,
  customMetricName: null,
  customPromqlQuery: null,
  customComparison: null,
  customThreshold: null,
  enabled: true,
};

const EMPTY_NOTIFICATION: UpsertTenantNotificationSettingsInput = {
  telegramEnabled: false,
  telegramBotToken: null,
  telegramChatId: null,
  sendResolved: true,
  alertPrefix: null,
};

const CUSTOM_PROMQL_PRESETS = [
  {
    key: "http-error-rate",
    label: "HTTP Error Rate (5xx %)",
    metricName: "HTTP Error Rate",
    query:
      "100 * (sum(rate(http_requests_total{status=~\"5..\"}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1))",
    comparison: ">",
    threshold: 5,
  },
  {
    key: "http-latency-p95",
    label: "HTTP Latency P95 (seconds)",
    metricName: "HTTP P95 Latency",
    query: "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
    comparison: ">",
    threshold: 1,
  },
  {
    key: "cpu-throttling",
    label: "Container CPU Throttling (%)",
    metricName: "CPU Throttling",
    query:
      "100 * (sum(rate(container_cpu_cfs_throttled_seconds_total[5m])) / clamp_min(sum(rate(container_cpu_cfs_periods_total[5m])), 1))",
    comparison: ">",
    threshold: 20,
  },
  {
    key: "container-restarts",
    label: "Container Restarts In 5m",
    metricName: "Container Restarts",
    query: "sum(increase(container_start_time_seconds[5m]))",
    comparison: ">",
    threshold: 1,
  },
  {
    key: "none",
    label: "No preset (manual)",
    metricName: null,
    query: null,
    comparison: null,
    threshold: null,
  },
] as const;

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function toNullableDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function valueOrEmpty(value: number | null): string {
  return value == null ? "" : String(value);
}

function alertPolicyToInput(policy: {
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  diskFreePercent: number | null;
  serverDownForMinutes: number | null;
  containerDownForMinutes: number | null;
  containerRestartCount: number | null;
  resourceAlertWindowMinutes: number | null;
  customMetricName: string | null;
  customPromqlQuery: string | null;
  customComparison: UpsertAlertPolicyInput["customComparison"];
  customThreshold: number | null;
  enabled: boolean;
}): UpsertAlertPolicyInput {
  return {
    cpuUsagePercent: policy.cpuUsagePercent,
    memoryUsagePercent: policy.memoryUsagePercent,
    diskFreePercent: policy.diskFreePercent,
    serverDownForMinutes: policy.serverDownForMinutes,
    containerDownForMinutes: policy.containerDownForMinutes,
    containerRestartCount: policy.containerRestartCount,
    resourceAlertWindowMinutes: policy.resourceAlertWindowMinutes ?? 5,
    customMetricName: policy.customMetricName,
    customPromqlQuery: policy.customPromqlQuery,
    customComparison: policy.customComparison,
    customThreshold: policy.customThreshold,
    enabled: policy.enabled,
  };
}

function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export default function AlertsPage() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");

  const [globalPolicy, setGlobalPolicy] = useState<UpsertAlertPolicyInput>(EMPTY_POLICY);
  const [tenantPolicy, setTenantPolicy] = useState<UpsertAlertPolicyInput>(EMPTY_POLICY);
  const [serverPolicy, setServerPolicy] = useState<UpsertAlertPolicyInput>(EMPTY_POLICY);
  const [notificationSettings, setNotificationSettings] = useState<UpsertTenantNotificationSettingsInput>(EMPTY_NOTIFICATION);
  const [tenantServers, setTenantServers] = useState<ServerResponse[]>([]);
  const [silences, setSilences] = useState<AlertSilence[]>([]);
  const [silenceScope, setSilenceScope] = useState<"all" | "tenant" | "server">("all");
  const [silenceActiveOnly, setSilenceActiveOnly] = useState(true);
  const [silenceForm, setSilenceForm] = useState({
    serverId: "",
    startsAt: "",
    endsAt: "",
    reason: "",
    enabled: true,
  });

  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [tenantMessage, setTenantMessage] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [silenceMessage, setSilenceMessage] = useState<string | null>(null);
  const [selectedPromqlPresetKey, setSelectedPromqlPresetKey] = useState<string>("none");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isSavingTenantPolicy, setIsSavingTenantPolicy] = useState(false);
  const [isSavingServerPolicy, setIsSavingServerPolicy] = useState(false);
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isSavingSilence, setIsSavingSilence] = useState(false);
  const [isLoadingSilences, setIsLoadingSilences] = useState(false);
  const [isLoadingServerPolicy, setIsLoadingServerPolicy] = useState(false);

  const canManageSettings = userRole === "admin" || userRole === "owner";
  const isAdmin = userRole === "admin";

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId],
  );

  const selectedServer = useMemo(
    () => tenantServers.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, tenantServers],
  );

  const activeSilenceCount = silences.filter((silence) => silence.activeNow).length;
  const surfaceCardClass =
    "relative overflow-hidden rounded-[28px] border border-[#243142] bg-[linear-gradient(180deg,rgba(18,25,34,0.98)_0%,rgba(12,17,26,0.98)_100%)] p-6 shadow-[0_22px_60px_rgba(2,7,16,0.24)]";
  const summaryCardClass =
    "rounded-[22px] border border-[#2a3546] bg-[linear-gradient(180deg,rgba(18,25,36,0.92)_0%,rgba(13,19,29,0.92)_100%)] p-4";
  const pillClass = "inline-flex rounded-full bg-[#162437] px-4 py-1 text-[12px] font-medium text-[#8db6ff]";
  const permissionLabel = canManageSettings
    ? isAdmin
      ? "Admin write access"
      : "Owner write access"
    : "Read-only access";
  const selectionLabel = selectedTenant?.name ?? "Choose a tenant";
  const serverSelectionLabel = selectedServer?.name ?? "Choose a server";
  const routingLabel = notificationSettings.telegramEnabled ? "Telegram enabled" : "Telegram disabled";
  const routingDetail = notificationSettings.telegramChatId ? `Chat ${notificationSettings.telegramChatId}` : "No chat ID";

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = "";
        const user = await getCurrentUser(accessToken);
        const normalizedRole = user.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole === "admin") {
          const [global, tenantRows] = await Promise.all([
            getGlobalAlertPolicy(accessToken),
            listTenants(accessToken),
          ]);

          setGlobalPolicy(alertPolicyToInput(global));

          setTenants(tenantRows);
          setSelectedTenantId((current) => current || tenantRows[0]?.id || "");
        } else {
          if (!user.tenantId) {
            throw new Error("No tenant assigned for this account.");
          }

          setSelectedTenantId(user.tenantId);
          setTenants([
            {
              id: user.tenantId,
              name: user.displayName ? `${user.displayName}'s tenant` : "Current Tenant",
              slug: "current-tenant",
              status: "active",
            },
          ]);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load alert settings.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPage();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      return;
    }

    const loadTenantSettings = async () => {
      setIsLoadingSilences(true);
      try {
        const accessToken = "";
        const [tenantPolicyResponse, notificationResponse, tenantServerRows, silenceRows] = await Promise.all([
          getTenantAlertPolicy(accessToken, selectedTenantId),
          getTenantNotificationSettings(accessToken, selectedTenantId),
          listTenantServers(accessToken, selectedTenantId),
          listAlertSilences(accessToken, selectedTenantId, {
            scope: silenceScope,
            activeOnly: silenceActiveOnly,
          }),
        ]);

        setTenantPolicy(alertPolicyToInput(tenantPolicyResponse));

        setNotificationSettings({
          telegramEnabled: notificationResponse.telegramEnabled,
          telegramBotToken: null,
          telegramChatId: notificationResponse.telegramChatId,
          sendResolved: notificationResponse.sendResolved,
          alertPrefix: notificationResponse.alertPrefix,
        });

        setTenantServers(tenantServerRows);
        setSelectedServerId(tenantServerRows[0]?.id ?? "");
        setSilences(silenceRows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load tenant alert settings.";
        setError(message);
      } finally {
        setIsLoadingSilences(false);
      }
    };

    void loadTenantSettings();
  }, [selectedTenantId, silenceScope, silenceActiveOnly]);

  useEffect(() => {
    if (!selectedTenantId || !selectedServerId) {
      setServerPolicy(EMPTY_POLICY);
      return;
    }

    const selectedServerExists = tenantServers.some((server) => server.id === selectedServerId);
    if (!selectedServerExists) {
      setServerPolicy(EMPTY_POLICY);
      return;
    }

    const loadServerPolicy = async () => {
      setIsLoadingServerPolicy(true);
      try {
        const accessToken = "";
        const serverPolicyResponse = await getServerAlertPolicy(accessToken, selectedTenantId, selectedServerId);
        setServerPolicy(alertPolicyToInput(serverPolicyResponse));
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load server alert policy.";
        setError(message);
        setServerPolicy(EMPTY_POLICY);
      } finally {
        setIsLoadingServerPolicy(false);
      }
    };

    void loadServerPolicy();
  }, [selectedServerId, selectedTenantId, tenantServers]);

  const handleSaveGlobalPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGlobalMessage(null);
    setError(null);

    setIsSavingGlobal(true);
    try {
      await saveGlobalAlertPolicy("", globalPolicy);
      setGlobalMessage("Global alert policy saved.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save global policy.";
      setError(message);
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleSaveTenantPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTenantMessage(null);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    setIsSavingTenantPolicy(true);
    try {
      await saveTenantAlertPolicy("", selectedTenantId, tenantPolicy);
      setTenantMessage("Tenant alert policy saved.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save tenant policy.";
      setError(message);
    } finally {
      setIsSavingTenantPolicy(false);
    }
  };

  const handleSaveServerPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerMessage(null);
    setError(null);

    if (!selectedTenantId || !selectedServerId) {
      setError("Select a tenant and server first.");
      return;
    }

    setIsSavingServerPolicy(true);
    try {
      await saveServerAlertPolicy("", selectedTenantId, selectedServerId, serverPolicy);
      setServerMessage("Server alert policy saved.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save server policy.";
      setError(message);
    } finally {
      setIsSavingServerPolicy(false);
    }
  };

  const handleSaveNotificationSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotificationMessage(null);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    setIsSavingNotification(true);
    try {
      await saveTenantNotificationSettings("", selectedTenantId, notificationSettings);
      setNotificationMessage("Notification settings saved.");
      setNotificationSettings((current) => ({ ...current, telegramBotToken: null }));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save notification settings.";
      setError(message);
    } finally {
      setIsSavingNotification(false);
    }
  };

  const handleTestTelegramRouting = async () => {
    setNotificationMessage(null);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    setIsTestingNotification(true);
    try {
      await testTenantTelegramRouting("", selectedTenantId, notificationSettings);
      setNotificationMessage("Telegram test message sent successfully.");
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : "Unable to send Telegram test message.";
      setError(message);
    } finally {
      setIsTestingNotification(false);
    }
  };

  const handleCreateSilence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSilenceMessage(null);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    const startsAtIso = localInputToIso(silenceForm.startsAt);
    const endsAtIso = localInputToIso(silenceForm.endsAt);
    if (!startsAtIso || !endsAtIso) {
      setError("Start and end time are required for the silence window.");
      return;
    }

    setIsSavingSilence(true);
    try {
      const createdSilence = await createAlertSilence("", selectedTenantId, {
        serverId: silenceForm.serverId || null,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        reason: textOrNull(silenceForm.reason),
        enabled: silenceForm.enabled,
      });

      const refreshedSilences = await listAlertSilences("", selectedTenantId, {
        scope: silenceScope,
        activeOnly: silenceActiveOnly,
      });
      setSilences(refreshedSilences);
      setSilenceForm({
        serverId: "",
        startsAt: "",
        endsAt: "",
        reason: "",
        enabled: true,
      });
      const matchesScope = silenceScope === "all" || silenceScope === createdSilence.scope;
      const matchesActiveFilter = !silenceActiveOnly || createdSilence.activeNow;

      if (matchesScope && matchesActiveFilter) {
        setSilenceMessage("Alert silence created.");
      } else {
        setSilenceMessage("Alert silence created. It is hidden by the current Scope or Active only filters.");
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to create alert silence.";
      setError(message);
    } finally {
      setIsSavingSilence(false);
    }
  };

  const handleDeleteSilence = async (silenceId: string) => {
    setSilenceMessage(null);
    setError(null);

    if (!selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    setIsLoadingSilences(true);
    try {
      await deleteAlertSilence("", selectedTenantId, silenceId);
      const refreshedSilences = await listAlertSilences("", selectedTenantId, {
        scope: silenceScope,
        activeOnly: silenceActiveOnly,
      });
      setSilences(refreshedSilences);
      setSilenceMessage("Alert silence deleted.");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete alert silence.";
      setError(message);
    } finally {
      setIsLoadingSilences(false);
    }
  };

  const applyPromqlPreset = () => {
    const selectedPreset = CUSTOM_PROMQL_PRESETS.find((preset) => preset.key === selectedPromqlPresetKey);
    if (!selectedPreset || selectedPreset.key === "none") {
      return;
    }

    setTenantPolicy((current) => ({
      ...current,
      customMetricName: selectedPreset.metricName,
      customPromqlQuery: selectedPreset.query,
      customComparison: selectedPreset.comparison,
      customThreshold: selectedPreset.threshold,
    }));
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading alert settings...</p>
        </main>
      </div>
    );
  }

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Alerts"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Alert Routing" : "Tenant Alerting",
            name: userRole === "admin" ? selectedTenant?.name ?? "Choose tenant" : "Current tenant",
            serversCount: tenantServers.length,
            onboardingRunning: 0,
            detailLines: [
              isAdmin ? "Global + tenant scope" : "Tenant scope",
              canManageSettings ? "Write access enabled" : "Read-only access",
            ],
          }}
        />

        <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
          <div className={pillClass}>
            ALERT CONTROL
          </div>

          <h1 className="mt-5 text-[34px] font-semibold leading-none text-[var(--app-text)] lg:text-[38px]">
            Alert Settings
          </h1>
          <p className="app-text-soft mt-3 max-w-[680px] text-[14px] leading-[20px]">
            Configure Telegram routing and threshold policies. Admin and owner can save changes. Members can view only.
          </p>

          {error ? <p className="mt-6 text-sm text-[#ff9b7a]">{error}</p> : null}

          <section className={`${surfaceCardClass} mt-6`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ec4ff]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#9ec4ff]" />
                  Policy cockpit
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
                    {permissionLabel}
                  </span>
                  <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
                    {isAdmin ? "Global + tenant + server" : "Tenant + server"}
                  </span>
                  <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
                    {selectedServerId ? "Server overrides enabled" : "Select a server to edit overrides"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[460px]">
                <div className={summaryCardClass}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Tenant</p>
                  <p className="mt-2 text-[15px] font-semibold text-[#f2f5fa]">{selectionLabel}</p>
                  <p className="mt-1 text-[12px] text-[#8c9eba]">{selectedTenant?.slug ?? "No tenant selected"}</p>
                </div>
                <div className={summaryCardClass}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Server</p>
                  <p className="mt-2 text-[15px] font-semibold text-[#f2f5fa]">{serverSelectionLabel}</p>
                  <p className="mt-1 text-[12px] text-[#8c9eba]">
                    {selectedServer?.environment ?? "Select a server to edit server policy"}
                  </p>
                </div>
                <div className={summaryCardClass}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Routing</p>
                  <p className="mt-2 text-[15px] font-semibold text-[#f2f5fa]">{routingLabel}</p>
                  <p className="mt-1 text-[12px] text-[#8c9eba]">
                    {routingDetail}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              {isAdmin ? (
                <section className={surfaceCardClass}>
                  <div className="inline-flex rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#9ec4ff]">
                    Scope
                  </div>
                  <h2 className="mt-3 text-[18px] font-semibold text-[var(--app-text)]">Tenant Scope</h2>
                  <p className="app-text-soft mt-1 text-[12px] leading-[18px]">
                    Select the tenant you want to manage. Server scope updates below will follow this selection.
                  </p>

                  <label className="mt-5 flex flex-col gap-2 text-sm">
                    <span className="app-text-soft text-[12px]">Tenant</span>
                    <select
                      value={selectedTenantId}
                      onChange={(event) => {
                        setSelectedTenantId(event.target.value);
                        setSelectedServerId("");
                      }}
                      className="app-input h-11 rounded-xl border border-white/10 px-3 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              ) : null}

              {canManageSettings ? (
                <section className={surfaceCardClass}>
                  <div className="inline-flex rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#9ec4ff]">
                    Scope
                  </div>
                  <h2 className="mt-3 text-[18px] font-semibold text-[var(--app-text)]">Server Scope</h2>
                  <p className="app-text-soft mt-1 text-[12px] leading-[18px]">
                    Choose a server under the selected tenant to edit its alert policy.
                  </p>

                  <label className="mt-5 flex flex-col gap-2 text-sm">
                    <span className="app-text-soft text-[12px]">Server</span>
                    <select
                      value={selectedServerId}
                      onChange={(event) => setSelectedServerId(event.target.value)}
                      disabled={!tenantServers.length}
                      className="app-input h-11 rounded-xl border border-white/10 px-3 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <option value="">{tenantServers.length ? "Select a server" : "No servers available"}</option>
                      {tenantServers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-4 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5">
                    <p className="app-text-soft text-[12px] leading-[18px]">
                      Server-level thresholds override tenant and global defaults for the selected server only.
                    </p>
                  </div>
                </section>
              ) : null}

              <section className={surfaceCardClass}>
                <div className="inline-flex rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#9ec4ff]">
                  Control notes
                </div>
                <h2 className="mt-3 text-[18px] font-semibold text-[var(--app-text)]">How this page behaves</h2>
                <div className="mt-4 space-y-3 text-[13px] leading-[19px] text-[#a8b3c2]">
                  <p>
                    Global policy is the fallback for everyone. Tenant policy narrows it for one tenant. Server policy
                    only affects the selected server.
                  </p>
                  <p>
                    Telegram routing is tenant-wide. Silences mute notifications without deleting the underlying alerts.
                  </p>
                  <p>
                    {canManageSettings
                      ? "You can edit the values below and save them in place."
                      : "You have read-only access here. Review the current thresholds and routing settings."}
                  </p>
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-[#314153] bg-[#111721] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Active silences</p>
                    <p className="mt-1 text-[18px] font-semibold text-[#f2f5fa]">{activeSilenceCount}</p>
                  </div>
                  <div className="rounded-2xl border border-[#314153] bg-[#111721] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Current scope</p>
                    <p className="mt-1 text-[15px] font-semibold text-[#f2f5fa]">
                      {selectedTenant?.name ?? "No tenant selected"}
                    </p>
                    <p className="mt-1 text-[12px] text-[#8c9eba]">
                      {selectedServer?.name ?? "Pick a server to tune server thresholds"}
                    </p>
                  </div>
                </div>
              </section>
            </aside>

            <div className="space-y-8">

          {isAdmin ? (
            <form onSubmit={handleSaveGlobalPolicy} className={`${surfaceCardClass} mt-8`}>
              <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Global Policy (Admin)</h2>
              <p className="app-text-soft mt-2 text-[14px]">
                Default thresholds for all tenants when tenant/server overrides are not set.
              </p>

              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <label className="block">
                  <span className="app-text-soft text-[13px]">CPU %</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={valueOrEmpty(globalPolicy.cpuUsagePercent)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      cpuUsagePercent: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
                <label className="block">
                  <span className="app-text-soft text-[13px]">Memory %</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={valueOrEmpty(globalPolicy.memoryUsagePercent)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      memoryUsagePercent: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
                <label className="block">
                  <span className="app-text-soft text-[13px]">Disk Free %</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={valueOrEmpty(globalPolicy.diskFreePercent)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      diskFreePercent: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <label className="block">
                  <span className="app-text-soft text-[13px]">Server Down (min)</span>
                  <input
                    type="number"
                    min={1}
                    value={valueOrEmpty(globalPolicy.serverDownForMinutes)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      serverDownForMinutes: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
                <label className="block">
                  <span className="app-text-soft text-[13px]">Container Down (min)</span>
                  <input
                    type="number"
                    min={1}
                    value={valueOrEmpty(globalPolicy.containerDownForMinutes)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      containerDownForMinutes: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
                <label className="block">
                  <span className="app-text-soft text-[13px]">Restart Count</span>
                  <input
                    type="number"
                    min={1}
                    value={valueOrEmpty(globalPolicy.containerRestartCount)}
                    onChange={(event) => setGlobalPolicy((current) => ({
                      ...current,
                      containerRestartCount: toNullableNumber(event.target.value),
                    }))}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4"
                  />
                </label>
              </div>

              <label className="mt-5 block">
                <span className="app-text-soft text-[13px]">Resource Alert Window (min)</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={valueOrEmpty(globalPolicy.resourceAlertWindowMinutes)}
                  onChange={(event) => setGlobalPolicy((current) => ({
                    ...current,
                    resourceAlertWindowMinutes: toNullableNumber(event.target.value),
                  }))}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4"
                />
                <p className="app-text-soft mt-2 text-[11px] leading-[16px]">
                  Used by CPU, memory, and disk alerts for the rule window and alert delay.
                </p>
              </label>

              <label className="mt-6 flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  checked={globalPolicy.enabled}
                  onChange={(event) => setGlobalPolicy((current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span className="app-text-soft">Global policy enabled</span>
              </label>

              {globalMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{globalMessage}</p> : null}

              <button
                type="submit"
                disabled={isSavingGlobal}
                className="app-button-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
              >
                {isSavingGlobal ? "Saving..." : "Save Global Policy"}
              </button>
            </form>
          ) : null}

          <form onSubmit={handleSaveNotificationSettings} className={`${surfaceCardClass} mt-8`}>
            <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Tenant Telegram Routing</h2>
            <p className="app-text-soft mt-2 text-[14px]">
              Alerts are isolated per tenant. Configure bot destination for the selected tenant.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="app-text-soft text-[13px]">Bot Token</span>
                <input
                  type="password"
                  value={notificationSettings.telegramBotToken ?? ""}
                  onChange={(event) => setNotificationSettings((current) => ({
                    ...current,
                    telegramBotToken: textOrNull(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  placeholder="123456789:AA..."
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>

              <label className="block">
                <span className="app-text-soft text-[13px]">Chat ID</span>
                <input
                  type="text"
                  value={notificationSettings.telegramChatId ?? ""}
                  onChange={(event) => setNotificationSettings((current) => ({
                    ...current,
                    telegramChatId: textOrNull(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  placeholder="-1001234567890"
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="app-text-soft text-[13px]">Alert Prefix</span>
                <input
                  type="text"
                  value={notificationSettings.alertPrefix ?? ""}
                  onChange={(event) => setNotificationSettings((current) => ({
                    ...current,
                    alertPrefix: textOrNull(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  placeholder="Company A"
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  checked={notificationSettings.telegramEnabled}
                  onChange={(event) => setNotificationSettings((current) => ({
                    ...current,
                    telegramEnabled: event.target.checked,
                  }))}
                  disabled={!canManageSettings}
                />
                <span className="app-text-soft">Enable Telegram alerts</span>
              </label>

              <label className="flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  checked={notificationSettings.sendResolved}
                  onChange={(event) => setNotificationSettings((current) => ({
                    ...current,
                    sendResolved: event.target.checked,
                  }))}
                  disabled={!canManageSettings}
                />
                <span className="app-text-soft">Send resolved notifications</span>
              </label>
            </div>

            {notificationMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{notificationMessage}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleTestTelegramRouting()}
                disabled={!canManageSettings || isSavingNotification || isTestingNotification}
                className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
              >
                {isTestingNotification ? "Sending test..." : "Send Test Telegram"}
              </button>

              <button
                type="submit"
                disabled={!canManageSettings || isSavingNotification || isTestingNotification}
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
              >
                {isSavingNotification ? "Saving..." : "Save Telegram Settings"}
              </button>
            </div>
          </form>

          <form onSubmit={handleSaveTenantPolicy} className={`${surfaceCardClass} mt-8`}>
            <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Tenant Alert Policy</h2>
            <p className="app-text-soft mt-2 text-[14px]">
              Tenant-level thresholds override global defaults.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="app-text-soft text-[13px]">CPU %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(tenantPolicy.cpuUsagePercent)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    cpuUsagePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Memory %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(tenantPolicy.memoryUsagePercent)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    memoryUsagePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Disk Free %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(tenantPolicy.diskFreePercent)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    diskFreePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="app-text-soft text-[13px]">Server Down (min)</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(tenantPolicy.serverDownForMinutes)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    serverDownForMinutes: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Container Down (min)</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(tenantPolicy.containerDownForMinutes)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    containerDownForMinutes: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Restart Count</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(tenantPolicy.containerRestartCount)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    containerRestartCount: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="app-text-soft text-[13px]">Resource Alert Window (min)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={valueOrEmpty(tenantPolicy.resourceAlertWindowMinutes)}
                onChange={(event) => setTenantPolicy((current) => ({
                  ...current,
                  resourceAlertWindowMinutes: toNullableNumber(event.target.value),
                }))}
                disabled={!canManageSettings}
                className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
              />
              <p className="app-text-soft mt-2 text-[11px] leading-[16px]">
                Used by CPU, memory, and disk alerts for the rule window and alert delay.
              </p>
            </label>

            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-[var(--app-text)]">Advanced Custom Alert (Optional)</h3>
              <p className="app-text-soft mt-1 text-[13px] leading-[19px]">
                Use this only if you need app-specific alert logic. If you do not need custom rules, leave these fields empty.
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_220px_220px]">
              <label className="block">
                <span className="app-text-soft text-[13px]">Custom Metric Name</span>
                <input
                  type="text"
                  value={tenantPolicy.customMetricName ?? ""}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    customMetricName: textOrNull(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>

              <label className="block">
                <span className="app-text-soft text-[13px]">Comparison</span>
                <select
                  value={tenantPolicy.customComparison ?? ""}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    customComparison: (event.target.value || null) as UpsertAlertPolicyInput["customComparison"],
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                >
                  <option value="">None</option>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                </select>
              </label>

              <label className="block">
                <span className="app-text-soft text-[13px]">Threshold</span>
                <input
                  type="number"
                  step="0.01"
                  value={valueOrEmpty(tenantPolicy.customThreshold)}
                  onChange={(event) => setTenantPolicy((current) => ({
                    ...current,
                    customThreshold: toNullableDecimal(event.target.value),
                  }))}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <span className="app-text-soft text-[13px]">Custom PromQL Presets</span>
                <select
                  value={selectedPromqlPresetKey}
                  onChange={(event) => setSelectedPromqlPresetKey(event.target.value)}
                  disabled={!canManageSettings}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                >
                  {CUSTOM_PROMQL_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={applyPromqlPreset}
                disabled={!canManageSettings || selectedPromqlPresetKey === "none"}
                className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium disabled:opacity-60"
              >
                Use Preset
              </button>
            </div>

            <label className="mt-5 block">
              <span className="app-text-soft text-[13px]">Custom PromQL</span>
              <input
                type="text"
                value={tenantPolicy.customPromqlQuery ?? ""}
                onChange={(event) => setTenantPolicy((current) => ({
                  ...current,
                  customPromqlQuery: textOrNull(event.target.value),
                }))}
                disabled={!canManageSettings}
                placeholder="avg(rate(http_requests_total[5m]))"
                className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
              />
            </label>

            <label className="mt-6 flex items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                checked={tenantPolicy.enabled}
                onChange={(event) => setTenantPolicy((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={!canManageSettings}
              />
              <span className="app-text-soft">Tenant policy enabled</span>
            </label>

            {tenantMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{tenantMessage}</p> : null}

            <button
              type="submit"
              disabled={!canManageSettings || isSavingTenantPolicy}
              className="app-button-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
            >
              {isSavingTenantPolicy ? "Saving..." : "Save Tenant Policy"}
            </button>
          </form>

          <form onSubmit={handleSaveServerPolicy} className={`${surfaceCardClass} mt-8`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Server Alert Policy</h2>
                <p className="app-text-soft mt-2 text-[14px]">
                  Server-level thresholds override tenant and global defaults for the selected server only.
                </p>
              </div>

              <div className="rounded-full bg-[#1b2630] px-4 py-2 text-xs text-[#a8b3c2]">
                {selectedServer ? selectedServer.name : isLoadingServerPolicy ? "Loading server policy..." : "No server selected"}
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="app-text-soft text-[13px]">CPU %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(serverPolicy.cpuUsagePercent)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    cpuUsagePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Memory %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(serverPolicy.memoryUsagePercent)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    memoryUsagePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Disk Free %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={valueOrEmpty(serverPolicy.diskFreePercent)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    diskFreePercent: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="app-text-soft text-[13px]">Server Down (min)</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(serverPolicy.serverDownForMinutes)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    serverDownForMinutes: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Container Down (min)</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(serverPolicy.containerDownForMinutes)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    containerDownForMinutes: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
              <label className="block">
                <span className="app-text-soft text-[13px]">Restart Count</span>
                <input
                  type="number"
                  min={1}
                  value={valueOrEmpty(serverPolicy.containerRestartCount)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    containerRestartCount: toNullableNumber(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="app-text-soft text-[13px]">Resource Alert Window (min)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={valueOrEmpty(serverPolicy.resourceAlertWindowMinutes)}
                onChange={(event) => setServerPolicy((current) => ({
                  ...current,
                  resourceAlertWindowMinutes: toNullableNumber(event.target.value),
                }))}
                disabled={!canManageSettings || !selectedServerId}
                className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
              />
              <p className="app-text-soft mt-2 text-[11px] leading-[16px]">
                Used by CPU, memory, and disk alerts for the rule window and alert delay.
              </p>
            </label>

            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-[var(--app-text)]">Advanced Custom Alert (Optional)</h3>
              <p className="app-text-soft mt-1 text-[13px] leading-[19px]">
                Use this only if you need app-specific alert logic on this server. Leave these fields empty to inherit from tenant/global settings.
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_220px_220px]">
              <label className="block">
                <span className="app-text-soft text-[13px]">Custom Metric Name</span>
                <input
                  type="text"
                  value={serverPolicy.customMetricName ?? ""}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    customMetricName: textOrNull(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>

              <label className="block">
                <span className="app-text-soft text-[13px]">Comparison</span>
                <select
                  value={serverPolicy.customComparison ?? ""}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    customComparison: (event.target.value || null) as UpsertAlertPolicyInput["customComparison"],
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                >
                  <option value="">None</option>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                </select>
              </label>

              <label className="block">
                <span className="app-text-soft text-[13px]">Threshold</span>
                <input
                  type="number"
                  step="0.01"
                  value={valueOrEmpty(serverPolicy.customThreshold)}
                  onChange={(event) => setServerPolicy((current) => ({
                    ...current,
                    customThreshold: toNullableDecimal(event.target.value),
                  }))}
                  disabled={!canManageSettings || !selectedServerId}
                  className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                />
              </label>
            </div>

            <label className="mt-6 flex items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                checked={serverPolicy.enabled}
                onChange={(event) => setServerPolicy((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={!canManageSettings || !selectedServerId}
              />
              <span className="app-text-soft">Server policy enabled</span>
            </label>

            {serverMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{serverMessage}</p> : null}

            <button
              type="submit"
              disabled={!canManageSettings || !selectedServerId || isSavingServerPolicy || isLoadingServerPolicy}
              className="app-button-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
            >
              {isSavingServerPolicy ? "Saving..." : "Save Server Policy"}
            </button>
          </form>

          <section className={`${surfaceCardClass} mt-8`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Alert Silences</h2>
                <p className="app-text-soft mt-2 text-[14px]">
                  Temporarily mute tenant or server alerts during maintenance windows.
                </p>
                <p className="app-text-soft mt-1 text-[12px]">
                  Note: Silences mute alert notifications. Alert events can still appear in alert history and dashboards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="app-text-soft">Scope</span>
                  <select
                    value={silenceScope}
                    onChange={(event) => setSilenceScope(event.target.value as "all" | "tenant" | "server")}
                    className="app-input h-10 rounded-xl px-3 text-[14px]"
                  >
                    <option value="all">All</option>
                    <option value="tenant">Tenant only</option>
                    <option value="server">Server only</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={silenceActiveOnly}
                    onChange={(event) => setSilenceActiveOnly(event.target.checked)}
                  />
                  <span className="app-text-soft">Active only</span>
                </label>
              </div>
            </div>

            <form onSubmit={handleCreateSilence} className="mt-6">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="app-text-soft text-[13px]">Server (optional)</span>
                  <select
                    value={silenceForm.serverId}
                    onChange={(event) => setSilenceForm((current) => ({ ...current, serverId: event.target.value }))}
                    disabled={!canManageSettings}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                  >
                    <option value="">Tenant scope</option>
                    {tenantServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Starts At</span>
                  <input
                    type="datetime-local"
                    value={silenceForm.startsAt}
                    onChange={(event) => setSilenceForm((current) => ({ ...current, startsAt: event.target.value }))}
                    disabled={!canManageSettings}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                  />
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Ends At</span>
                  <input
                    type="datetime-local"
                    value={silenceForm.endsAt}
                    onChange={(event) => setSilenceForm((current) => ({ ...current, endsAt: event.target.value }))}
                    disabled={!canManageSettings}
                    className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                  />
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Reason</span>
                  <input
                    type="text"
                    value={silenceForm.reason}
                    onChange={(event) => setSilenceForm((current) => ({ ...current, reason: event.target.value }))}
                    disabled={!canManageSettings}
                    placeholder="Planned deployment"
                    className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={silenceForm.enabled}
                    onChange={(event) => setSilenceForm((current) => ({ ...current, enabled: event.target.checked }))}
                    disabled={!canManageSettings}
                  />
                  <span className="app-text-soft">Enable this silence immediately</span>
                </label>

                <button
                  type="submit"
                  disabled={!canManageSettings || isSavingSilence}
                  className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
                >
                  {isSavingSilence ? "Creating..." : "Create Silence"}
                </button>
              </div>
            </form>

            {silenceMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{silenceMessage}</p> : null}

            <div className="mt-6 space-y-3">
              {isLoadingSilences ? <p className="app-text-soft text-sm">Loading silences...</p> : null}

              {!isLoadingSilences && silences.length === 0 ? (
                <p className="app-text-soft text-sm">
                  {silenceActiveOnly
                    ? "No active silences found for this filter. Disable Active only to view scheduled or ended silences."
                    : "No silences found for this filter."}
                </p>
              ) : null}

              {silences.map((silence) => (
                <article key={silence.id} className="app-panel-soft rounded-xl px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--app-text)]">
                        {silence.scope === "server" ? "Server Silence" : "Tenant Silence"}
                        {silence.activeNow ? " • Active" : " • Scheduled/Ended"}
                      </p>
                      <p className="app-text-soft mt-1 text-xs">Notifications are muted while active.</p>
                      <p className="app-text-soft mt-1 text-xs">
                        {new Date(silence.startsAt).toLocaleString()} - {new Date(silence.endsAt).toLocaleString()}
                      </p>
                      {silence.reason ? <p className="app-text-soft mt-1 text-xs">Reason: {silence.reason}</p> : null}
                    </div>

                    {canManageSettings ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteSilence(silence.id)}
                        className="app-button-secondary inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-medium"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {!canManageSettings ? (
            <section className="app-panel-soft mt-8 rounded-xl px-6 py-5">
              <p className="text-[15px] text-[var(--app-text)]">Read-only access</p>
              <p className="app-text-soft mt-2 text-sm">
                Only admin and owner roles can update alert settings. You can still review current policy values here.
              </p>
              <Link
                href="/dashboard"
                className="app-button-secondary mt-5 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
              >
                Back to Dashboard
              </Link>
            </section>
          ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
