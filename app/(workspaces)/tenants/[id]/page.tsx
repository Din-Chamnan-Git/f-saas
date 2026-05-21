"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getAdminTenantDetailData,
  updateTenant,
  type AdminTenantDetailData,
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

function TenantDetailSummaryCard({
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

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenantDetail, setTenantDetail] = useState<AdminTenantDetailData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    const loadTenantDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole !== "admin") {
          setTenantDetail(null);
          return;
        }

        if (!tenantId) {
          throw new Error("Tenant id is missing.");
        }

        const detail = await getAdminTenantDetailData(accessToken, tenantId);
        setTenantDetail(detail);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load tenant detail.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTenantDetail();
  }, [tenantId]);

  const handleOpenWorkspace = () => {
    if (!tenantDetail) return;

    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantDetail.tenant.id);
    router.push("/dashboard");
  };

  const handleToggleTenantStatus = async () => {
    if (!tenantDetail) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const nextStatus = tenantDetail.profile.status === "disabled" ? "active" : "disabled";
      const updatedTenant = await updateTenant("", tenantDetail.tenant.id, {
        name: tenantDetail.profile.name,
        slug: tenantDetail.profile.slug,
        status: nextStatus,
      });

      setTenantDetail((current) =>
        current
          ? {
              ...current,
              tenant: updatedTenant,
              profile: {
                ...current.profile,
                status: updatedTenant.status.toLowerCase(),
              },
            }
          : current,
      );
      setShowStatusModal(false);
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
          <p className="app-text-soft text-sm">Loading tenant detail...</p>
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
            label: userRole === "admin" ? "Tenant Context" : "Active Tenant",
            name: userRole === "admin" ? tenantDetail?.tenantContext.name ?? "Tenant" : "Current tenant",
            serversCount: 0,
            onboardingRunning: 0,
            detailLines: userRole === "admin" ? tenantDetail?.tenantContext.detailLines : undefined,
          }}
        />

        {userRole !== "admin" ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Admin-only area</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Tenant detail management belongs to platform admins. Owner and member users should stay scoped to the workspace.
            </p>
            <Link
              href="/dashboard"
              className="app-button-secondary mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
            >
              Back to Workspace
            </Link>
          </section>
        ) : (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]" data-node-id="133:168">
            <div className="inline-flex rounded-full bg-[#553819] px-4 py-1 text-[12px] font-medium text-[#ffd09a]">
              ADMIN CONSOLE
            </div>

            <h1 className="mt-5 text-[42px] font-semibold leading-none text-[var(--app-text)]">Tenant Detail</h1>
            <p className="app-text-soft mt-3 max-w-[640px] text-[17px] leading-[22px]">
              Inspect tenant ownership, lifecycle state, and operational rollup before jumping into a tenant workspace.
            </p>

            {error ? <p className="mt-6 text-sm text-[#ff9b7a]">{error}</p> : null}

            {tenantDetail ? (
              <>
                <section className="app-card mt-8 rounded-[18px] p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Tenant Profile</h2>
                      <p className="mt-5 text-[28px] font-semibold leading-none text-[var(--app-text)]">{tenantDetail.profile.name}</p>
                      <p className="app-text-soft mt-3 text-[14px]">Slug: {tenantDetail.profile.slug}</p>
                      <p className="app-text-soft mt-5 text-[14px]">{tenantDetail.profile.createdLabel}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/servers/create?tenantId=${tenantDetail.tenant.id}`}
                        className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium"
                      >
                        Create Server
                      </Link>
                      <span
                        className={`inline-flex rounded-full px-4 py-1 text-[12px] font-medium ${
                          tenantDetail.profile.status === "disabled"
                            ? "bg-[#4a2030] text-[#ffd0da]"
                            : "bg-[#1f5b45] text-[#c0f2db]"
                        }`}
                      >
                        {tenantDetail.profile.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowStatusModal(true)}
                        className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium ${
                          tenantDetail.profile.status === "disabled"
                            ? "app-button-primary hover:brightness-110"
                            : "app-button-secondary"
                        }`}
                      >
                        {tenantDetail.profile.status === "disabled" ? "Enable Tenant" : "Disable Tenant"}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenWorkspace}
                        className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium hover:brightness-110"
                      >
                        Open Workspace
                      </button>
                    </div>
                  </div>
                </section>

                <div className="mt-7 grid gap-4 xl:grid-cols-4">
                  {tenantDetail.summaryCards.map((card) => (
                    <TenantDetailSummaryCard key={card.title} title={card.title} value={card.value} hint={card.hint} />
                  ))}
                </div>

                <div className="mt-8 grid gap-7 xl:grid-cols-2">
                  <section className="app-card rounded-[18px] p-6">
                    <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Owner Assignment</h2>

                    <p className="app-text-soft mt-8 text-[13px] font-medium">Primary owner</p>
                    <div className="app-panel-soft mt-3 rounded-xl px-5 py-4">
                      <p className="text-[16px] font-medium text-[var(--app-text)]">{tenantDetail.ownerAssignment.primaryOwner}</p>
                    </div>

                    <p className="app-text-soft mt-6 text-[13px] font-medium">Secondary contacts</p>
                    <div className="app-panel-soft mt-3 rounded-xl px-5 py-4">
                      {tenantDetail.ownerAssignment.secondaryContacts.length ? (
                        tenantDetail.ownerAssignment.secondaryContacts.map((contact) => (
                          <p key={contact} className="text-[14px] leading-7 text-[#f8f8f8]">
                            {contact}
                          </p>
                        ))
                      ) : (
                        <p className="app-text-soft text-[14px]">No secondary contacts available.</p>
                      )}
                    </div>

                    <Link
                      href={`/owners?tenantId=${tenantDetail.tenant.id}`}
                      className="app-button-secondary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium"
                    >
                      Change Owner
                    </Link>
                  </section>

                  <section className="app-card rounded-[18px] p-6">
                    <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Admin Notes</h2>
                    <p className="app-text-soft mt-8 max-w-[420px] text-[14px] leading-[20px]">
                      Use this screen before handing the tenant to an owner or investigating issues across tenants.
                    </p>

                    <div className="app-panel-soft mt-8 rounded-xl px-5 py-4">
                      <p className="text-[14px] font-medium text-[var(--app-text)]">Pending work</p>
                      <div className="mt-4 space-y-3">
                        {tenantDetail.adminNotes.map((note, index) => (
                          <p key={`${index + 1}-${note}`} className="app-text-soft text-[14px]">
                            {index + 1}. {note}
                          </p>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                {showStatusModal ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
                    <div className="app-card w-full max-w-[520px] rounded-[24px] p-6 shadow-2xl">
                      <p className="inline-flex rounded-full bg-[#553819] px-4 py-1 text-[12px] font-medium text-[#ffd09a]">
                        Confirm tenant status change
                      </p>
                      <h3 className="mt-4 text-[24px] font-semibold text-[var(--app-text)]">
                        {tenantDetail.profile.status === "disabled" ? "Enable tenant" : "Disable tenant"}
                      </h3>
                      <p className="app-text-soft mt-3 text-[14px] leading-[22px]">
                        {tenantDetail.profile.status === "disabled"
                          ? `This will let ${tenantDetail.profile.name} log in again.`
                          : `This will block ${tenantDetail.profile.name} tenant users from login while admins keep full access.`}
                      </p>

                      {actionError ? <p className="mt-4 text-sm text-[#ff9b7a]">{actionError}</p> : null}

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setShowStatusModal(false)}
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
                          {actionLoading ? "Saving..." : tenantDetail.profile.status === "disabled" ? "Enable tenant" : "Disable tenant"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
