"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import WorkspaceContainer from "@/components/layouts/workspace-container";
import StateCard from "@/components/ui/state-card";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getEffectiveAlertPolicy,
  getServerAlertPolicy,
  saveServerAlertPolicy,
} from "@/services/alertingService";
import {
  getServer,
  getServerOverview,
  listTenants,
  type ServerOverviewResponse,
  type ServerResponse,
  type TenantResponse,
} from "@/services/workspaceService";
import type { EffectiveAlertPolicy, UpsertAlertPolicyInput } from "@/types/alerting";

export const dynamic = "force-dynamic";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
  Metrics: "/metrics",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
  Metrics: "/metrics",
};

function buildOverviewCards(overview: ServerOverviewResponse | null) {
  if (!overview) {
    return [
      { title: "CPU", value: "--", hint: "Overview not available yet.", dotColor: "bg-[#2f3744]" },
      { title: "Memory", value: "--", hint: "Overview not available yet.", dotColor: "bg-[#2f3744]" },
      { title: "Disk", value: "--", hint: "Overview not available yet.", dotColor: "bg-[#2f3744]" },
      { title: "Status", value: "--", hint: "Overview not available yet.", dotColor: "bg-[#2f3744]" },
    ];
  }

  const status = overview.status.toLowerCase();
  const statusDotColor =
    status === "up"
      ? "bg-[#0f766e]"
      : status === "degraded"
        ? "bg-[#ca8a04]"
        : status === "down"
          ? "bg-[#dc2626]"
          : "bg-[#334155]";

  return [
    {
      title: "CPU",
      value: `${overview.cpuUsagePercent.toFixed(1)}%`,
      hint: "Current CPU usage from server overview.",
      dotColor: overview.cpuUsagePercent >= 85 ? "bg-[#dc2626]" : overview.cpuUsagePercent >= 65 ? "bg-[#ca8a04]" : "bg-[#0f766e]",
    },
    {
      title: "Memory",
      value: `${overview.memoryUsagePercent.toFixed(1)}%`,
      hint: "Current memory usage from server overview.",
      dotColor: overview.memoryUsagePercent >= 85 ? "bg-[#dc2626]" : overview.memoryUsagePercent >= 65 ? "bg-[#ca8a04]" : "bg-[#0f766e]",
    },
    {
      title: "Disk",
      value: `${overview.diskUsagePercent.toFixed(1)}%`,
      hint: "Current disk usage from server overview.",
      dotColor: overview.diskUsagePercent >= 85 ? "bg-[#dc2626]" : overview.diskUsagePercent >= 65 ? "bg-[#ca8a04]" : "bg-[#0f766e]",
    },
    {
      title: "Status",
      value: overview.status.toUpperCase(),
      hint: "Health state reported by the metrics backend.",
      dotColor: statusDotColor,
    },
  ];
}

const EMPTY_SERVER_POLICY: UpsertAlertPolicyInput = {
  cpuUsagePercent: null,
  memoryUsagePercent: null,
  diskFreePercent: null,
  serverDownForMinutes: null,
  containerDownForMinutes: null,
  containerRestartCount: null,
  customMetricName: null,
  customPromqlQuery: null,
  customComparison: null,
  customThreshold: null,
  enabled: true,
};

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

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function valueOrEmpty(value: number | null): string {
  return value == null ? "" : String(value);
}

function getNextDueDateLabel(dueDay: number | null): string {
  if (!dueDay) {
    return "Not configured";
  }

  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const thisMonthDue = new Date(Date.UTC(year, month, dueDay));
  const due = today.getTime() > thisMonthDue.getTime() ? new Date(Date.UTC(year, month + 1, dueDay)) : thisMonthDue;

  return due.toISOString().slice(0, 10);
}

function getReminderWindowLabel(dueDay: number | null): string {
  if (!dueDay) {
    return "No reminder schedule";
  }

  return "3 days and 1 day before due date";
}

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const serverId = typeof params?.id === "string" ? params.id : "";
  const tenantIdFromQuery = searchParams.get("tenantId") ?? "";

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [server, setServer] = useState<ServerResponse | null>(null);
  const [overview, setOverview] = useState<ServerOverviewResponse | null>(null);
  const [serverPolicy, setServerPolicy] = useState<UpsertAlertPolicyInput>(EMPTY_SERVER_POLICY);
  const [effectivePolicy, setEffectivePolicy] = useState<EffectiveAlertPolicy | null>(null);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenantId, tenants],
  );

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        let resolvedTenantId = tenantIdFromQuery;
        let tenantRows: TenantResponse[] = [];

        if (normalizedRole === "admin") {
          tenantRows = await listTenants(accessToken);
          setTenants(tenantRows);
          if (!resolvedTenantId) {
            throw new Error("Tenant id is required to open this server.");
          }
        } else {
          resolvedTenantId = currentUser.tenantId ?? "";
          if (!resolvedTenantId) {
            throw new Error("No tenant available for current user.");
          }
        }

        setTenantId(resolvedTenantId);
        const [serverResponse, overviewResponse, serverPolicyResponse, effectivePolicyResponse] = await Promise.all([
          getServer(accessToken, resolvedTenantId, serverId),
          getServerOverview(accessToken, resolvedTenantId, serverId).catch(() => null),
          getServerAlertPolicy(accessToken, resolvedTenantId, serverId),
          getEffectiveAlertPolicy(accessToken, resolvedTenantId, serverId).catch(() => null),
        ]);

        setServer(serverResponse);
        setOverview(overviewResponse);
        setServerPolicy({
          cpuUsagePercent: serverPolicyResponse.cpuUsagePercent,
          memoryUsagePercent: serverPolicyResponse.memoryUsagePercent,
          diskFreePercent: serverPolicyResponse.diskFreePercent,
          serverDownForMinutes: serverPolicyResponse.serverDownForMinutes,
          containerDownForMinutes: serverPolicyResponse.containerDownForMinutes,
          containerRestartCount: serverPolicyResponse.containerRestartCount,
          customMetricName: serverPolicyResponse.customMetricName,
          customPromqlQuery: serverPolicyResponse.customPromqlQuery,
          customComparison: serverPolicyResponse.customComparison,
          customThreshold: serverPolicyResponse.customThreshold,
          enabled: serverPolicyResponse.enabled,
        });
        setEffectivePolicy(effectivePolicyResponse);

        if (normalizedRole !== "admin") {
          setTenants([{ id: resolvedTenantId, name: "Current tenant", slug: "current-tenant", status: "ACTIVE" }]);
        } else if (!tenantRows.length) {
          setTenants([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to open the server workspace.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPage();
  }, [serverId, tenantIdFromQuery]);

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Opening server workspace...</p>
        </main>
      </div>
    );
  }

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const hrefByItem = userRole === "admin" ? adminHrefByItem : tenantHrefByItem;
  const tenantDisplayName = userRole === "admin" ? resolvedTenant?.name ?? "Selected tenant" : "Current tenant";
  const summaryCards = buildOverviewCards(overview);
  const canManageAlertOverride = userRole === "admin" || userRole === "owner";

  const handleSaveServerPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPolicyMessage(null);
    setError(null);

    if (!tenantId || !serverId) {
      setError("Missing tenant or server id for policy update.");
      return;
    }

    setIsSavingPolicy(true);
    try {
      await saveServerAlertPolicy("", tenantId, serverId, serverPolicy);
      const refreshedEffective = await getEffectiveAlertPolicy("", tenantId, serverId).catch(() => null);
      setEffectivePolicy(refreshedEffective);
      setPolicyMessage("Server override policy saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save server override policy.");
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Servers"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={hrefByItem}
          tenant={{
            label: "SERVER WORKSPACE",
            name: server?.name ?? "Server",
            serversCount: 1,
            onboardingRunning: 0,
            detailLines: [tenantDisplayName, server?.ipAddress ?? "No IP available"],
          }}
        />

        <WorkspaceContainer
          title={server?.name ?? "Server"}
          subtitle="Inspect server identity, SSH configuration, and monitoring status from one workspace."
          actions={
            <div className="flex flex-wrap gap-3">
              <Link href="/servers" className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium">
                Back to Servers
              </Link>
              {server ? (
                <Link
                  href={`/metrics?tenantId=${server.tenantId}&serverId=${server.id}`}
                  className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
                >
                  Open Metrics
                </Link>
              ) : null}
              {server ? (
                <Link
                  href={`/servers/${server.id}/edit?tenantId=${server.tenantId}`}
                  className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium hover:brightness-110"
                >
                  Edit Server
                </Link>
              ) : null}
            </div>
          }
        >
          {error ? (
            <div className="app-card mt-6 rounded-2xl p-6">
              <p className="text-sm text-[#ff9b7a]">{error}</p>
            </div>
          ) : null}

          {server ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <StateCard key={card.title} card={card} />
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <section className="app-card rounded-3xl p-6">
                  <p className="app-kicker">Server Identity</p>
                  <h2 className="app-section-title mt-4">Connection Profile</h2>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Tenant</p>
                      <p className="mt-2 text-[18px] text-[var(--app-text)]">{tenantDisplayName}</p>
                    </div>
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Environment</p>
                      <p className="mt-2 text-[18px] capitalize text-[var(--app-text)]">{server.environment}</p>
                    </div>
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">IP Address</p>
                      <p className="mt-2 font-mono text-[16px] text-[var(--app-text)]">{server.ipAddress}</p>
                    </div>
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Instance</p>
                      <p className="mt-2 font-mono text-[16px] text-[var(--app-text)]">{server.instance}</p>
                    </div>
                  </div>
                </section>

                <section className="app-card rounded-3xl p-6">
                  <p className="app-kicker">Onboarding</p>
                  <h2 className="app-section-title mt-4">SSH Settings</h2>

                  <div className="mt-6 space-y-4">
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Ansible Host</p>
                      <p className="mt-2 font-mono text-[15px] text-[var(--app-text)]">{server.ansibleHost}</p>
                    </div>
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Ansible User</p>
                      <p className="mt-2 text-[16px] text-[var(--app-text)]">{server.ansibleUser}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="app-panel-soft rounded-2xl p-4">
                        <p className="app-label">Become</p>
                        <p className="mt-2 text-[16px] text-[var(--app-text)]">{server.ansibleBecome ? "Enabled" : "Disabled"}</p>
                      </div>
                      <div className="app-panel-soft rounded-2xl p-4">
                        <p className="app-label">Docker</p>
                        <p className="mt-2 text-[16px] text-[var(--app-text)]">{server.dockerEnabled ? "Enabled" : "Disabled"}</p>
                      </div>
                    </div>
                    <div className="app-panel-soft rounded-2xl p-4">
                      <p className="app-label">Python Interpreter</p>
                      <p className="mt-2 font-mono text-[15px] text-[var(--app-text)]">
                        {server.ansiblePythonInterpreter || "Not configured"}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="app-card mt-6 rounded-3xl p-6">
                <p className="app-kicker">Billing</p>
                <h2 className="app-section-title mt-4">Payment Reminder</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="app-panel-soft rounded-2xl p-4">
                    <p className="app-label">Note</p>
                    <p className="mt-2 text-[15px] text-[var(--app-text)]">{server.billingNote ?? "Not configured"}</p>
                  </div>
                  <div className="app-panel-soft rounded-2xl p-4">
                    <p className="app-label">Amount</p>
                    <p className="mt-2 text-[15px] text-[var(--app-text)]">
                      {server.billingAmount == null || !server.billingCurrency
                        ? "Not configured"
                        : `${server.billingCurrency} ${server.billingAmount.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="app-panel-soft rounded-2xl p-4">
                    <p className="app-label">Next Due Date</p>
                    <p className="mt-2 text-[15px] text-[var(--app-text)]">{getNextDueDateLabel(server.billingDueDay)}</p>
                  </div>
                  <div className="app-panel-soft rounded-2xl p-4">
                    <p className="app-label">Reminder Window</p>
                    <p className="mt-2 text-[15px] text-[var(--app-text)]">{getReminderWindowLabel(server.billingDueDay)}</p>
                  </div>
                </div>
              </section>

              <form onSubmit={handleSaveServerPolicy} className="app-card mt-6 rounded-3xl p-6">
                <p className="app-kicker">Alerts</p>
                <h2 className="app-section-title mt-4">Server Override Policy</h2>
                <p className="app-text-soft mt-3 max-w-[760px] text-[14px] leading-[20px]">
                  Override tenant/global thresholds for this server only. Admin and owner can update this policy.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="app-label">CPU %</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={valueOrEmpty(serverPolicy.cpuUsagePercent)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        cpuUsagePercent: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                  <label className="block">
                    <span className="app-label">Memory %</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={valueOrEmpty(serverPolicy.memoryUsagePercent)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        memoryUsagePercent: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                  <label className="block">
                    <span className="app-label">Disk Free %</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={valueOrEmpty(serverPolicy.diskFreePercent)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        diskFreePercent: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="app-label">Server Down (min)</span>
                    <input
                      type="number"
                      min={1}
                      value={valueOrEmpty(serverPolicy.serverDownForMinutes)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        serverDownForMinutes: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                  <label className="block">
                    <span className="app-label">Container Down (min)</span>
                    <input
                      type="number"
                      min={1}
                      value={valueOrEmpty(serverPolicy.containerDownForMinutes)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        containerDownForMinutes: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                  <label className="block">
                    <span className="app-label">Restart Count</span>
                    <input
                      type="number"
                      min={1}
                      value={valueOrEmpty(serverPolicy.containerRestartCount)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        containerRestartCount: toNullableNumber(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px_200px]">
                  <label className="block">
                    <span className="app-label">Custom Metric Name</span>
                    <input
                      type="text"
                      value={serverPolicy.customMetricName ?? ""}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        customMetricName: toNullableText(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>

                  <label className="block">
                    <span className="app-label">Comparison</span>
                    <select
                      value={serverPolicy.customComparison ?? ""}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        customComparison: (event.target.value || null) as UpsertAlertPolicyInput["customComparison"],
                      }))}
                      disabled={!canManageAlertOverride}
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
                    <span className="app-label">Threshold</span>
                    <input
                      type="number"
                      step="0.01"
                      value={valueOrEmpty(serverPolicy.customThreshold)}
                      onChange={(event) => setServerPolicy((current) => ({
                        ...current,
                        customThreshold: toNullableDecimal(event.target.value),
                      }))}
                      disabled={!canManageAlertOverride}
                      className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="app-label">Custom PromQL</span>
                  <input
                    type="text"
                    value={serverPolicy.customPromqlQuery ?? ""}
                    onChange={(event) => setServerPolicy((current) => ({
                      ...current,
                      customPromqlQuery: toNullableText(event.target.value),
                    }))}
                    disabled={!canManageAlertOverride}
                    placeholder="avg(rate(http_requests_total[5m]))"
                    className="app-input mt-2 h-11 w-full rounded-xl px-4 disabled:opacity-70"
                  />
                </label>

                <label className="mt-4 flex items-center gap-3 text-[14px]">
                  <input
                    type="checkbox"
                    checked={serverPolicy.enabled}
                    onChange={(event) => setServerPolicy((current) => ({ ...current, enabled: event.target.checked }))}
                    disabled={!canManageAlertOverride}
                  />
                  <span className="app-text-soft">Server override enabled</span>
                </label>

                {policyMessage ? <p className="mt-4 text-sm text-[#7bd7a6]">{policyMessage}</p> : null}

                <button
                  type="submit"
                  disabled={!canManageAlertOverride || isSavingPolicy}
                  className="app-button-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:opacity-60"
                >
                  {isSavingPolicy ? "Saving..." : "Save Server Override"}
                </button>

                <div className="app-panel-soft mt-6 rounded-2xl p-4">
                  <p className="app-label">Effective policy source</p>
                  {effectivePolicy ? (
                    <div className="mt-3 grid gap-2 text-[13px] text-[var(--app-text)] md:grid-cols-2">
                      <p>CPU: {effectivePolicy.cpuUsagePercent}% ({effectivePolicy.cpuUsageSource})</p>
                      <p>Memory: {effectivePolicy.memoryUsagePercent}% ({effectivePolicy.memoryUsageSource})</p>
                      <p>Disk Free: {effectivePolicy.diskFreePercent}% ({effectivePolicy.diskFreeSource})</p>
                      <p>Server Down: {effectivePolicy.serverDownForMinutes}m ({effectivePolicy.serverDownSource})</p>
                      <p>Container Down: {effectivePolicy.containerDownForMinutes}m ({effectivePolicy.containerDownSource})</p>
                      <p>Restart Count: {effectivePolicy.containerRestartCount} ({effectivePolicy.containerRestartSource})</p>
                      <p>Enabled: {effectivePolicy.enabled ? "yes" : "no"} ({effectivePolicy.enabledSource})</p>
                      <p>Custom Metric Source: {effectivePolicy.customMetricSource}</p>
                    </div>
                  ) : (
                    <p className="app-text-soft mt-2 text-sm">Effective policy preview is not available yet.</p>
                  )}
                </div>
              </form>
            </>
          ) : null}
        </WorkspaceContainer>
      </main>
    </div>
  );
}
