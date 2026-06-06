"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import WorkspaceContainer from "@/components/layouts/workspace-container";
import ServerCard from "@/components/ui/server-card";
import StateCard from "@/components/ui/state-card";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  createAlertSilence,
  deleteAlertSilence,
  listAlertSilences,
} from "@/services/alertingService";
import {
  getAdminServerDirectoryData,
  getTenantWorkspaceDashboardData,
  type AdminServerDirectoryData,
} from "@/services/workspaceService";
import type { AlertSilence } from "@/types/alerting";
import type { ServerRow } from "@/types/server";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
};

const SERVER_ALERT_MUTE_END_AT = new Date(Date.UTC(2099, 11, 31, 23, 59, 59)).toISOString();

async function loadActiveServerAlertSilences(
  accessToken: string,
  serverRows: ServerRow[],
): Promise<Record<string, AlertSilence[]>> {
  const tenantIds = [...new Set(serverRows.map((server) => server.tenantId).filter((tenantId): tenantId is string => Boolean(tenantId)))];
  const silenceRowsByTenant = await Promise.all(
    tenantIds.map(async (tenantId) => {
      const silences = await listAlertSilences(accessToken, tenantId, {
        scope: "server",
        activeOnly: true,
      }).catch(() => []);

      return silences.filter((silence) => silence.activeNow && Boolean(silence.serverId));
    }),
  );

  const byServerId: Record<string, AlertSilence[]> = {};
  for (const silenceRows of silenceRowsByTenant) {
    for (const silence of silenceRows) {
      if (!silence.serverId) {
        continue;
      }

      byServerId[silence.serverId] = [...(byServerId[silence.serverId] ?? []), silence];
    }
  }

  return byServerId;
}

export default function ServersPage() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenantName, setTenantName] = useState("Current Tenant");
  const [summaryCards, setSummaryCards] = useState<
    Array<{ title: string; value: string; hint: string; dotColor: string }>
  >([]);
  const [adminDirectory, setAdminDirectory] = useState<AdminServerDirectoryData | null>(null);
  const [serverRows, setServerRows] = useState<ServerRow[]>([]);
  const [serverAlertSilencesByServerId, setServerAlertSilencesByServerId] = useState<Record<string, AlertSilence[]>>({});
  const [activeAlertActionServerId, setActiveAlertActionServerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsTenantCreation, setNeedsTenantCreation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageServerAlertSilences = userRole === "admin" || userRole === "owner";

  const filteredServerRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return serverRows;

    return serverRows.filter((server) => {
      return (
        server.name.toLowerCase().includes(keyword) ||
        server.ip.toLowerCase().includes(keyword) ||
        server.environment.toLowerCase().includes(keyword)
      );
    });
  }, [searchTerm, serverRows]);

  const loadServers = async () => {
    setIsLoading(true);
    setError(null);
    setNeedsTenantCreation(false);

    try {
      const accessToken = "";
      const currentUser = await getCurrentUser(accessToken);
      const normalizedRole = currentUser.role.toLowerCase() as UserRole;
      setUserRole(normalizedRole);

      if (normalizedRole === "admin") {
        const directory = await getAdminServerDirectoryData(accessToken);

        setAdminDirectory(directory);
        setTenantName(directory.currentView.name);
        setSummaryCards(directory.summaryCards);
        setServerRows(directory.serverRows);
        setServerAlertSilencesByServerId(await loadActiveServerAlertSilences(accessToken, directory.serverRows));
        if (!directory.serverRows.length) {
          setNeedsTenantCreation(true);
        }
        return;
      }

      if (!currentUser.tenantId) {
        throw new Error("No tenant available for current user.");
      }

      const dashboard = await getTenantWorkspaceDashboardData(accessToken, currentUser.tenantId);
      setAdminDirectory(null);
      setTenantName(dashboard.tenantName);
      setSummaryCards(dashboard.summaryCards);
      setServerRows(dashboard.serverRows);
      setServerAlertSilencesByServerId(await loadActiveServerAlertSilences(accessToken, dashboard.serverRows));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load servers.";
      setError(message);
      setNeedsTenantCreation(message === "No tenant available for current user.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadServers();
  }, []);

  const refreshAlertSilenceState = async (rows: ServerRow[]) => {
    const accessToken = "";
    setServerAlertSilencesByServerId(await loadActiveServerAlertSilences(accessToken, rows));
  };

  const handleToggleServerAlertMute = async (server: ServerRow) => {
    if (!canManageServerAlertSilences) {
      setError("You do not have permission to mute alerts for this server.");
      return;
    }

    if (!server.id || !server.tenantId) {
      setError("Missing tenant or server id for alert toggle.");
      return;
    }

    setError(null);
    setActiveAlertActionServerId(server.id);

    try {
      const currentSilences = serverAlertSilencesByServerId[server.id] ?? [];
      if (currentSilences.length > 0) {
        await Promise.all(currentSilences.map((silence) => deleteAlertSilence("", server.tenantId as string, silence.id)));
        setServerAlertSilencesByServerId((current) => {
          const next = { ...current };
          delete next[server.id as string];
          return next;
        });
      } else {
        const createdSilence = await createAlertSilence("", server.tenantId as string, {
          serverId: server.id,
          startsAt: new Date().toISOString(),
          endsAt: SERVER_ALERT_MUTE_END_AT,
          reason: `Muted from server list for ${server.name}`,
          enabled: true,
        });
        setServerAlertSilencesByServerId((current) => ({
          ...current,
          [server.id as string]: [createdSilence],
        }));
      }

      await refreshAlertSilenceState(serverRows);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update alert mute state.");
    } finally {
      setActiveAlertActionServerId(null);
    }
  };

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const hrefByItem = userRole === "admin" ? adminHrefByItem : tenantHrefByItem;

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading servers...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Servers"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={hrefByItem}
          tenant={{
            label: userRole === "admin" ? "Current View" : "Active Tenant",
            name: tenantName,
            serversCount: serverRows.length,
            onboardingRunning: serverRows.filter((server) => server.onboarding === "running").length,
            detailLines:
              userRole === "admin"
                ? [
                    adminDirectory?.currentView.detailLines[0] ?? "Cross-tenant inventory",
                    needsTenantCreation ? "Create the first server to populate this view" : adminDirectory?.currentView.detailLines[1] ?? "Admin sees all servers",
                  ]
                : undefined,
          }}
        />

        <WorkspaceContainer
          title="Servers"
          subtitle="Manage onboarding, monitoring health, metrics targets, and logs per server."
          actions={
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <input
                type="text"
                placeholder="Search name, IP, or alias"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                disabled={needsTenantCreation}
                className="h-11 flex-1 rounded-xl border border-[#262e3d] bg-[#1a212e] px-4 text-sm text-[#8c9eba] outline-none placeholder:text-[#6f819c] focus:border-[#9ec4ff] disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[260px]"
              />
              <Link
                href={userRole === "admin" ? "/servers/create" : "/servers/create"}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#c98a00] px-6 text-sm text-[#f2f5fa] hover:brightness-110"
              >
                Add Server
              </Link>
            </div>
          }
        >
          {!needsTenantCreation ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <StateCard key={card.title} card={card} />
                ))}
              </div>

              <div className="app-toolbar mt-6 flex flex-wrap items-center gap-3 rounded-2xl p-4">
                <button type="button" className="app-button-secondary h-10 rounded-xl px-4 text-sm">
                  All environments
                </button>
                <button type="button" className="app-button-secondary h-10 rounded-xl px-4 text-sm">
                  All statuses
                </button>
                <button type="button" className="app-button-secondary h-10 rounded-xl px-4 text-sm">
                  Docker enabled
                </button>
                <button
                  type="button"
                  className="app-button-secondary ml-auto h-10 rounded-xl px-5 text-sm"
                  onClick={() => {
                    void loadServers();
                  }}
                >
                  Refresh
                </button>
              </div>
            </>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[#ff9b7a]">{error}</p> : null}

          {needsTenantCreation ? (
            <div className="app-card mt-6 rounded-3xl p-6 md:p-8">
              <h2 className="text-3xl text-[var(--app-text)]">{userRole === "admin" ? "No servers yet" : "No tenant available"}</h2>
              <p className="app-text-soft mt-2 max-w-2xl text-sm">
                {userRole === "admin"
                  ? "Admin now sees every server across all tenants here. Create a tenant and add the first server to populate the directory."
                  : "Servers are tenant-scoped. Create a tenant first, then return here to manage monitoring targets and onboarding."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/tenants/create"
                  className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm hover:brightness-110"
                >
                  Create Tenant
                </Link>
                <button
                  type="button"
                  className="app-button-secondary h-11 rounded-xl px-6 text-sm"
                  onClick={() => {
                    void loadServers();
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : null}

          {!needsTenantCreation ? (
            <div className="app-card mt-6 rounded-3xl p-4 md:p-6" data-node-id="41:2">
              <h2 className="text-3xl text-[var(--app-text)]">Server Inventory</h2>
              <p className="app-text-soft mt-2 text-sm">
                {userRole === "admin"
                  ? "Track every SSH-ready server across all tenants from one platform list."
                  : "Track SSH-ready servers and operational state from one list."}
              </p>

              <div className="app-panel-soft app-text-soft mt-5 hidden rounded-xl px-4 py-3 text-xs md:grid md:grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr]">
                <span>Server</span>
                <span>Environment</span>
                <span>Onboarding</span>
                <span>Metrics</span>
                <span>Logs</span>
                <span>Actions</span>
              </div>

              <div className="mt-3 space-y-3">
                {filteredServerRows.map((server) => (
                  <ServerCard
                    key={`${server.name}-${server.ip}`}
                    server={server}
                    alertMuted={Boolean(server.id && serverAlertSilencesByServerId[server.id]?.length)}
                    isAlertToggleLoading={server.id === activeAlertActionServerId}
                    onToggleAlerts={canManageServerAlertSilences && server.id ? () => void handleToggleServerAlertMute(server) : undefined}
                  />
                ))}
                {!filteredServerRows.length ? (
                  <p className="app-card app-text-soft rounded-2xl p-4 text-sm">
                    No servers match your search.
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="app-text-soft text-sm">{`Showing ${filteredServerRows.length} of ${serverRows.length} servers`}</p>
                <button type="button" className="app-button-secondary h-10 rounded-xl px-6 text-sm">
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </WorkspaceContainer>
      </main>
    </div>
  );
}
