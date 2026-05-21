"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getAdminTenantDirectoryData,
  updateTenant,
  type AdminTenantDirectoryData,
  type AdminTenantDirectoryRow,
} from "@/services/workspaceService";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const ACTIVE_TENANT_STORAGE_KEY = "activeTenantId";
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
};

function DirectorySummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="app-card rounded-[18px] p-[18px]">
      <p className="app-text-soft text-[13px]">{title}</p>
      <p className="mt-2 text-[34px] font-semibold leading-none text-[var(--app-text)]">{value}</p>
      <p className="app-text-soft mt-4 text-[13px] leading-[18px]">{hint}</p>
    </article>
  );
}

function HealthBadge({
  label,
  tone,
}: {
  label: AdminTenantDirectoryRow["healthLabel"];
  tone: AdminTenantDirectoryRow["healthTone"];
}) {
  const toneClass =
    tone === "healthy"
      ? "bg-[#1f5b45] text-[#c0f2db]"
      : tone === "needs-owner"
        ? "bg-[#553819] text-[#ffd09a]"
        : "bg-[#36375c] text-[#c9cfff]";

  return <span className={`inline-flex rounded-full px-4 py-1 text-[12px] font-medium ${toneClass}`}>{label}</span>;
}

export default function AdminTenantDirectoryPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [directory, setDirectory] = useState<AdminTenantDirectoryData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerStateFilter, setOwnerStateFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [tenantPendingAction, setTenantPendingAction] = useState<AdminTenantDirectoryRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = "";
      const currentUser = await getCurrentUser(accessToken);
      const normalizedRole = currentUser.role.toLowerCase() as UserRole;
      setUserRole(normalizedRole);

      if (normalizedRole !== "admin") {
        setDirectory(null);
        return;
      }

      const result = await getAdminTenantDirectoryData(accessToken);
      setDirectory(result);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load tenant directory.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, []);

  const filteredRows = useMemo(() => {
    const rows = directory?.tenantRows ?? [];
    const keyword = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !keyword || row.name.toLowerCase().includes(keyword) || row.slug.toLowerCase().includes(keyword);
      const matchesOwnerState =
        ownerStateFilter === "all" ||
        (ownerStateFilter === "assigned" && row.ownerAssigned) ||
        (ownerStateFilter === "unassigned" && !row.ownerAssigned);
      const matchesHealth = healthFilter === "all" || row.healthTone === healthFilter;

      return matchesSearch && matchesOwnerState && matchesHealth;
    });
  }, [directory?.tenantRows, healthFilter, ownerStateFilter, searchTerm]);

  const handleOpenWorkspace = (tenantId: string) => {
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    router.push("/dashboard");
  };

  const handlePrimaryAction = (row: AdminTenantDirectoryRow) => {
    if (row.ownerAssigned) {
      handleOpenWorkspace(row.id);
      return;
    }

    router.push(`/owners?tenantId=${row.id}`);
  };

  const handleEditTenant = (tenantId: string) => {
    router.push(`/tenants/${tenantId}`);
  };

  const handleToggleTenantStatus = async () => {
    if (!tenantPendingAction) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const accessToken = "";
      const nextStatus = tenantPendingAction.status.toLowerCase() === "disabled" ? "active" : "disabled";
      await updateTenant(accessToken, tenantPendingAction.id, {
        name: tenantPendingAction.name,
        slug: tenantPendingAction.slug,
        status: nextStatus,
      });

      await loadDirectory();
      setTenantPendingAction(null);
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Unable to update tenant status.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading tenant directory...</p>
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
          activeItem={userRole === "admin" ? "Tenants" : "Servers"}
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Current View" : "Active Tenant",
            name: userRole === "admin" ? directory?.currentView.name ?? "Admin listing" : "Current tenant",
            serversCount: 0,
            onboardingRunning: 0,
            detailLines: userRole === "admin" ? directory?.currentView.detailLines : undefined,
          }}
        />

        {userRole !== "admin" ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Admin-only area</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Tenant directory management belongs to platform admins. Owner and member users should stay scoped to the workspace.
            </p>
            <Link
              href="/dashboard"
              className="app-button-secondary mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
            >
              Back to Workspace
            </Link>
          </section>
        ) : (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]" data-node-id="133:73">
            <div className="inline-flex rounded-full bg-[#553819] px-4 py-1 text-[12px] font-medium text-[#ffd09a]">
              ADMIN CONSOLE
            </div>

            <h1 className="mt-5 text-[42px] font-semibold leading-none text-[var(--app-text)]">Tenant Directory</h1>
            <p className="app-text-soft mt-3 max-w-[640px] text-[17px] leading-[22px]">
              Browse every tenant, inspect ownership, and decide which workspace to enter without auto-switching context.
            </p>

            <div className="mt-10 grid gap-4 xl:grid-cols-4">
              {directory?.summaryCards.map((card) => (
                <DirectorySummaryCard key={card.title} title={card.title} value={card.value} hint={card.hint} />
              ))}
            </div>

            <section className="app-card mt-8 rounded-[18px] p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search tenant or slug"
                  className="app-input h-[42px] rounded-xl px-5 text-sm outline-none focus:border-[#5cb7ff] xl:w-[220px]"
                />

                <select
                  value={ownerStateFilter}
                  onChange={(event) => setOwnerStateFilter(event.target.value)}
                  className="app-input app-text-soft h-[42px] rounded-xl px-5 text-sm outline-none focus:border-[#5cb7ff] xl:w-[180px]"
                >
                  <option value="all">All owner states</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>

                <select
                  value={healthFilter}
                  onChange={(event) => setHealthFilter(event.target.value)}
                  className="app-input app-text-soft h-[42px] rounded-xl px-5 text-sm outline-none focus:border-[#5cb7ff] xl:w-[170px]"
                >
                  <option value="all">Health status</option>
                  <option value="healthy">Healthy</option>
                  <option value="attention">Attention</option>
                  <option value="needs-owner">Needs owner</option>
                </select>

                <Link
                  href="/tenants/create"
                  className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium hover:brightness-110 xl:ml-auto xl:w-[146px]"
                >
                  Create Tenant
                </Link>
              </div>
            </section>

            <section className="app-card mt-6 rounded-[18px] p-6">
              <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Tenant Inventory</h2>
              <p className="app-text-soft mt-2 text-[14px]">One row per tenant with owner, health, and admin actions.</p>

              {error ? <p className="mt-5 text-sm text-[#ff9b7a]">{error}</p> : null}

              <div className="app-panel-soft app-text-soft mt-6 hidden rounded-xl px-5 py-3 md:grid md:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1fr] md:items-center md:gap-4">
                <p className="text-[13px] font-medium">Tenant</p>
                <p className="text-[13px] font-medium">Owner</p>
                <p className="text-[13px] font-medium">Health</p>
                <p className="text-[13px] font-medium">Servers</p>
                <p className="text-[13px] font-medium">Actions</p>
              </div>

              <div className="mt-4 space-y-3">
                {filteredRows.map((row) => (
                  <article
                    key={row.id}
                    className="app-panel-soft rounded-[14px] px-5 py-4 md:grid md:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1fr] md:items-center md:gap-4"
                  >
                    <div>
                      <p className="text-[16px] font-medium text-[var(--app-text)]">{row.name}</p>
                      <p className="app-text-soft mt-1 text-[13px]">{row.slug}</p>
                    </div>

                    <p className="mt-4 text-[14px] text-[var(--app-text)] md:mt-0">{row.ownerLabel}</p>

                    <div className="mt-4 md:mt-0">
                      <HealthBadge label={row.healthLabel} tone={row.healthTone} />
                    </div>

                    <p className="mt-4 text-[14px] text-[var(--app-text)] md:mt-0">{row.serverCount} servers</p>

                    <div className="mt-4 flex gap-3 md:mt-0 md:justify-start">
                      <button
                        type="button"
                        onClick={() => handlePrimaryAction(row)}
                        className="app-button-secondary inline-flex h-11 min-w-[58px] items-center justify-center rounded-xl px-4 text-sm font-medium"
                      >
                        {row.ownerAssigned ? "Open" : "Assign"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditTenant(row.id)}
                        className="app-button-secondary inline-flex h-11 min-w-[58px] items-center justify-center rounded-xl px-4 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setTenantPendingAction(row)}
                        className={`inline-flex h-11 min-w-[58px] items-center justify-center rounded-xl px-4 text-sm font-medium ${
                          row.status.toLowerCase() === "disabled"
                            ? "bg-[#1f5b45] text-[#d1fae5]"
                            : "bg-[#4a2030] text-[#ffd0da]"
                        }`}
                      >
                        {row.status.toLowerCase() === "disabled" ? "Enable" : "Disable"}
                      </button>
                    </div>
                  </article>
                ))}

                {!filteredRows.length ? (
                  <div className="app-panel-soft rounded-[14px] px-5 py-6">
                    <p className="app-text-soft text-sm">No tenants match the current search and filter state.</p>
                  </div>
                ) : null}
              </div>
            </section>

            {tenantPendingAction ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
                <div className="app-card w-full max-w-[520px] rounded-[24px] p-6 shadow-2xl">
                  <p className="inline-flex rounded-full bg-[#553819] px-4 py-1 text-[12px] font-medium text-[#ffd09a]">
                    Confirm tenant status change
                  </p>
                  <h3 className="mt-4 text-[24px] font-semibold text-[var(--app-text)]">
                    {tenantPendingAction.status.toLowerCase() === "disabled" ? "Enable tenant" : "Disable tenant"}
                  </h3>
                  <p className="app-text-soft mt-3 text-[14px] leading-[22px]">
                    {tenantPendingAction.status.toLowerCase() === "disabled"
                      ? `Re-enable ${tenantPendingAction.name} so tenant users can log in again.`
                      : `Disable ${tenantPendingAction.name}. Tenant users will be blocked from login, but admins can still manage the server.`}
                  </p>

                  {actionError ? <p className="mt-4 text-sm text-[#ff9b7a]">{actionError}</p> : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setTenantPendingAction(null)}
                      className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleTenantStatus()}
                      className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Saving..." : tenantPendingAction.status.toLowerCase() === "disabled" ? "Enable tenant" : "Disable tenant"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
