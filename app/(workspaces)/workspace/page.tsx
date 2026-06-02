"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import WorkspaceContainer from "@/components/layouts/workspace-container";
import FleetHealthTable from "@/components/ui/fleet-health-table";
import ServerCard from "@/components/ui/server-card";
import StateCard from "@/components/ui/state-card";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getAdminDashboardData,
  getTenantWorkspaceDashboardData,
  type AdminDashboardData,
} from "@/services/workspaceService";
import type { ServerRow } from "@/types/server";

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

function AdminSummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="app-card rounded-[18px] border border-[#263246] bg-[linear-gradient(180deg,#1a222d_0%,#141b24_100%)] p-[18px] shadow-[0_18px_40px_rgba(2,7,16,0.25)]">
      <p className="text-[11px] tracking-[0.18em] text-[#7f92ad]">{title}</p>
      <p className="mt-3 text-[38px] font-semibold leading-none text-[var(--app-text)]">{value}</p>
    </article>
  );
}

function AdminActivityRow({
  title,
  detail,
  timestampLabel,
}: {
  title: string;
  detail: string;
  timestampLabel: string;
}) {
  return (
    <div className="app-panel-soft grid gap-3 rounded-xl px-6 py-4 text-sm md:grid-cols-[1.4fr_0.8fr_auto] md:items-center">
      <p className="text-[15px] text-[var(--app-text)]">{title}</p>
      <p className="app-text-soft text-[14px]">{detail}</p>
      <p className="text-[14px] font-medium text-[#5cb7ff]">{timestampLabel}</p>
    </div>
  );
}

function AdminActionLink({
  href,
  label,
  tone = "secondary",
}: {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        tone === "primary"
          ? "app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium hover:brightness-110"
          : "app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium"
      }
    >
      {label}
    </Link>
  );
}

function AdminDashboardView({
  dashboard,
  error,
  onRefresh,
}: {
  dashboard: AdminDashboardData | null;
  error: string | null;
  onRefresh: () => Promise<void>;
}) {
  const summaryCards = dashboard?.summaryCards ?? [];
  const activityItems = dashboard?.activityItems ?? [];

  return (
    <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]" data-node-id="133:2">
      <div className="inline-flex rounded-full bg-[#553819] px-4 py-1 text-[12px] font-medium text-[#ffd09a]">
        PLATFORM COMMAND
      </div>

      <h1 className="mt-5 text-[42px] font-semibold leading-none text-[var(--app-text)]">Overview</h1>
      <p className="app-text-soft mt-3 max-w-[520px] text-[16px] leading-[22px]">
        Fleet health, owner status, and recent operations.
      </p>

      <div className="mt-10 grid gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <AdminSummaryCard key={card.title} title={card.title} value={card.value} hint={card.hint} />
        ))}
      </div>

      <section className="app-card mt-6 rounded-[18px] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-[var(--app-text)]">Quick Actions</h2>
            <p className="app-text-soft mt-2 text-[14px] leading-[20px]">Open core admin pages directly.</p>
          </div>
          <div className="rounded-2xl border border-[#314153] bg-[#141b24] px-4 py-3 text-right">
            <p className="text-[10px] tracking-[0.18em] text-[#6f819c]">PLATFORM SCOPE</p>
            <p className="mt-2 text-xl text-[var(--app-text)]">{dashboard?.platformScope.name ?? "All tenants"}</p>
            {(dashboard?.platformScope.detailLines ?? []).map((line) => (
              <p key={line} className="mt-1 text-sm text-[#8ea0bb]">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <AdminActionLink href="/tenants" label="Tenant Directory" tone="primary" />
          <AdminActionLink href="/owners" label="Provision Owners" />
          <AdminActionLink href="/servers" label="Inspect Fleet" />
          <AdminActionLink href="/jobs" label="Review Jobs" />
          <AdminActionLink href="/metrics" label="Platform Metrics" />
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </section>

      <FleetHealthTable rows={dashboard?.fleetRows ?? []} />

      <section id="platform-activity" className="app-card mt-8 rounded-[18px] p-6">
        <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Operations Feed</h2>
        <p className="app-text-soft mt-2 text-[14px] leading-[20px]">
          Latest onboarding and verification outcomes across the managed fleet.
        </p>

        {error ? <p className="mt-5 text-sm text-[#ff9b7a]">{error}</p> : null}

        {dashboard?.hasTenants === false ? (
          <div className="app-panel-soft mt-6 rounded-xl px-6 py-5">
            <p className="text-[15px] text-[var(--app-text)]">No tenants created yet.</p>
            <p className="app-text-soft mt-2 text-sm">
              Start by creating the first tenant, then return here to track platform-wide activity.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {activityItems.map((item, index) => (
              <AdminActivityRow
                key={`${item.id}-${index}`}
                title={item.title}
                detail={item.detail}
                timestampLabel={item.timestampLabel}
              />
            ))}
          </div>
        )}
      </section>

      <section className="app-card mt-8 rounded-[18px] p-6">
        <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Next Actions</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <AdminActionLink href="/tenants/create" label="Create Tenant" tone="primary" />
          <AdminActionLink href="/owners" label="Assign Owner" />
        </div>
      </section>
    </section>
  );
}

export default function WorkspacePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tenantName, setTenantName] = useState("Current Tenant");
  const [summaryCards, setSummaryCards] = useState<
    Array<{ title: string; value: string; hint: string; dotColor: string }>
  >([]);
  const [serverRows, setServerRows] = useState<ServerRow[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsTenantCreation, setNeedsTenantCreation] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = "";
      const currentUser = await getCurrentUser(accessToken);
      const normalizedRole = currentUser.role.toLowerCase() as UserRole;

      setUserRole(normalizedRole);

      if (normalizedRole === "admin") {
        const dashboard = await getAdminDashboardData(accessToken);

        setAdminDashboard(dashboard);
        setTenantName(dashboard.platformScope.name);
        setSummaryCards([]);
        setServerRows([]);
        setNeedsTenantCreation(false);
        return;
      }

      if (!currentUser.tenantId) {
        throw new Error("No tenant available for current user.");
      }

      const dashboard = await getTenantWorkspaceDashboardData(accessToken, currentUser.tenantId);

      setAdminDashboard(null);
      setTenantName(dashboard.tenantName);
      setSummaryCards(dashboard.summaryCards);
      setServerRows(dashboard.serverRows);
      setNeedsTenantCreation(false);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load workspace data.";
      setError(message);
      setNeedsTenantCreation(message === "No tenant available for current user.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading workspace...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem={userRole === "admin" ? "Dashboard" : "Servers"}
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Platform Scope" : "Active Tenant",
            name: userRole === "admin" ? adminDashboard?.platformScope.name ?? "All tenants" : tenantName,
            serversCount: userRole === "admin" ? (adminDashboard?.fleetRows.length ?? 0) : serverRows.length,
            onboardingRunning: userRole === "admin" ? 0 : serverRows.filter((server) => server.onboarding === "running").length,
            detailLines: userRole === "admin" ? adminDashboard?.platformScope.detailLines : undefined,
            badgeText: userRole === "admin" ? "Command view" : undefined,
          }}
        />

        {userRole === "admin" ? (
          <AdminDashboardView dashboard={adminDashboard} error={error} onRefresh={loadWorkspace} />
        ) : (
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
                  className="h-11 flex-1 rounded-xl border border-[#262e3d] bg-[#1a212e] px-4 text-sm text-[#8c9eba] outline-none placeholder:text-[#6f819c] focus:border-[#9ec4ff] sm:min-w-[260px]"
                />
                <Link
                  href="/servers/create"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#fc7342] px-6 text-sm text-[#f2f5fa] hover:brightness-110"
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

                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-[#1a212e] p-4">
                  <button type="button" className="h-10 rounded-xl border border-[#262e3d] bg-[#141a24] px-4 text-sm text-[#8c9eba]">
                    All environments
                  </button>
                  <button type="button" className="h-10 rounded-xl border border-[#262e3d] bg-[#141a24] px-4 text-sm text-[#8c9eba]">
                    All statuses
                  </button>
                  <button type="button" className="h-10 rounded-xl border border-[#262e3d] bg-[#141a24] px-4 text-sm text-[#8c9eba]">
                    Docker enabled
                  </button>
                  <button
                    type="button"
                    className="ml-auto h-10 rounded-xl border border-[#262e3d] bg-[#141a24] px-5 text-sm text-[#8c9eba]"
                    onClick={() => {
                      void loadWorkspace();
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </>
            ) : null}

            {error ? <p className="mt-3 text-sm text-[#ff9b7a]">{error}</p> : null}

            {needsTenantCreation ? (
              <div className="mt-6 rounded-3xl bg-[#1a212e] p-6 md:p-8">
                <h2 className="text-3xl text-[#f2f5fa]">No tenant assigned</h2>
                <p className="mt-2 max-w-2xl text-sm text-[#8c9eba]">
                  Your account does not have a tenant assignment yet. A platform admin needs to create the tenant and attach your
                  access before you can manage servers, onboarding jobs, metrics, and logs.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="h-12 rounded-2xl border border-[#262e3d] bg-[#151d29] px-6 text-sm text-[#dce3f0] hover:bg-[#202939]"
                    onClick={() => {
                      void loadWorkspace();
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`mt-6 rounded-3xl bg-[#1a212e] p-4 md:p-6 ${needsTenantCreation ? "hidden" : ""}`}>
              <h2 className="text-3xl">Server Inventory</h2>
              <p className="mt-2 text-sm text-[#8c9eba]">Track SSH-ready servers and operational state from one list.</p>

              <div className="mt-5 hidden rounded-xl border border-[#262e3d] bg-[#141a24] px-4 py-3 text-xs text-[#8c9eba] md:grid md:grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr]">
                <span>Server</span>
                <span>Environment</span>
                <span>Onboarding</span>
                <span>Metrics</span>
                <span>Logs</span>
                <span>Actions</span>
              </div>

              <div className="mt-3 space-y-3">
                {filteredServerRows.map((server) => (
                  <ServerCard key={server.name} server={server} />
                ))}
                {!filteredServerRows.length ? (
                  <p className="rounded-2xl border border-[#262e3d] bg-[#171c26] p-4 text-sm text-[#8c9eba]">
                    No servers match your search.
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-[#8c9eba]">{`Showing ${filteredServerRows.length} of ${serverRows.length} servers`}</p>
                <button type="button" className="h-10 rounded-xl border border-[#262e3d] bg-[#29364a] px-6 text-sm text-[#f2f5fa]">
                  Next
                </button>
              </div>
            </div>
          </WorkspaceContainer>
        )}
      </main>
    </div>
  );
}
