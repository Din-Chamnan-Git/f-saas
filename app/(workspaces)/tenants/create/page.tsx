"use client";

import Sidebar from "@/components/layouts/sidebar";
import WorkspaceContainer from "@/components/layouts/workspace-container";
import { getCurrentUser, type UserRole } from "@/services/authService";
import { showToast } from "@/components/ui/toast";
import { createTenant, listTenants, type TenantResponse } from "@/services/workspaceService";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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

const guidanceItems = [
  "Tenant name should match the customer or business account operators will recognize.",
  "Slug is used by the platform for labels and identifiers, so keep it lowercase with hyphens only.",
  "After saving, review the tenant list and open the tenant workspace you want to manage.",
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default function CreateTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hasEditedSlug, setHasEditedSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [tenantRows, setTenantRows] = useState<TenantResponse[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    if (!hasEditedSlug) {
      setSlug(slugify(name));
    }
  }, [hasEditedSlug, name]);

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const tenants = await listTenants("");
      setTenantRows(tenants);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load tenants.";
      showToast(message, "error");
    } finally {
      setIsLoadingTenants(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setActiveTenantId(localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY));

      try {
        const currentUser = await getCurrentUser("");
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole === "admin") {
          await loadTenants();
        } else {
          setIsLoadingTenants(false);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load access details.";
        showToast(message, "error");
        setIsLoadingTenants(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    bootstrap();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const normalizedSlug = slugify(slug);

    if (!trimmedName || !normalizedSlug) {
      showToast("Tenant name and slug are required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      const createdTenant = await createTenant("", {
        name: trimmedName,
        slug: normalizedSlug,
      });

      showToast(`Tenant "${createdTenant.name}" created successfully.`, "success");
      setName("");
      setSlug("");
      setHasEditedSlug(false);
      await loadTenants();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to create tenant.";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTenant = (tenantId: string) => {
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    setActiveTenantId(tenantId);
    router.push("/dashboard");
  };

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;

  if (isCheckingAccess) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading access details...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem={userRole === "admin" ? "Tenants" : "Servers"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            name: userRole === "admin" ? "Tenant setup" : "Current tenant",
            serversCount: 0,
            onboardingRunning: 0,
          }}
        />

        {userRole !== "admin" ? (
          <WorkspaceContainer
            title="Tenant Workspace"
            subtitle="Owners and members work only inside their assigned tenant."
            actions={
              <Link
                href="/tenants"
                className="app-button-secondary inline-flex h-11 items-center rounded-xl px-5 text-sm"
              >
                Back to Tenant List
              </Link>
            }
          >
            <div className="app-card mt-6 rounded-[22px] p-6">
              <h2 className="text-[28px] leading-none text-[var(--app-text)]">Admin-only area</h2>
              <p className="app-text-soft mt-3 max-w-2xl text-sm">
                Tenant creation and tenant switching belong to the platform admin UI. Owners should stay scoped to their own
                tenant workspace and manage servers, metrics, logs, and onboarding there.
              </p>
            </div>
          </WorkspaceContainer>
        ) : (
        <WorkspaceContainer
          title="Create Tenant"
          subtitle="Register a tenant before onboarding servers, metrics targets, and logs."
          actions={
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <Link
                href="/tenants"
                className="app-button-secondary inline-flex h-11 items-center rounded-xl px-5 text-sm"
              >
                Back to Tenant List
              </Link>
              <button
                type="submit"
                form="create-tenant-form"
                disabled={isSubmitting}
                className="app-button-primary h-11 rounded-xl px-6 text-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Save Tenant"}
              </button>
            </div>
          }
        >
          <div className="app-card mt-6 rounded-[22px] p-6">
            <h2 className="text-[28px] leading-none text-[var(--app-text)]">Before you save</h2>
            <p className="app-text-soft mt-3 text-sm">
              This screen creates the tenant identity used across workspace access, server ownership, and monitoring scope.
            </p>

            <ul className="app-text-soft mt-6 space-y-4 text-sm">
              {guidanceItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#c98a00]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <form id="create-tenant-form" className="app-card mt-8 rounded-[22px] p-6" onSubmit={handleSubmit}>
            <h2 className="text-[28px] leading-none text-[var(--app-text)]">Tenant Configuration</h2>
            <p className="app-text-soft mt-3 text-sm">
              Keep the setup short and operational. The backend currently requires only tenant name and slug.
            </p>

            <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <p className="text-base text-[var(--app-text)]">Basic Info</p>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <label className="app-text-soft block text-sm">
                    <span>Tenant name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nan Corp"
                      className="app-input mt-3 h-[54px] w-full rounded-[14px] px-5 text-sm outline-none transition focus:border-[#9ec4ff]"
                    />
                  </label>

                  <label className="app-text-soft block text-sm">
                    <span>Slug</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(event) => {
                        setHasEditedSlug(true);
                        setSlug(event.target.value);
                      }}
                      placeholder="nan-corp"
                      className="app-input mt-3 h-[54px] w-full rounded-[14px] px-5 text-sm outline-none transition focus:border-[#9ec4ff]"
                    />
                  </label>
                </div>

                <div className="app-panel-soft mt-6 rounded-[18px] p-5">
                  <p className="text-sm text-[var(--app-text)]">Slug rules</p>
                  <p className="app-text-soft mt-2 text-sm">
                    Use lowercase letters, numbers, and single hyphens only. The form auto-generates a slug until you edit it manually.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="app-panel-soft rounded-[18px] p-5">
                  <p className="text-sm text-[var(--app-text)]">Slug preview</p>
                  <p className="mt-3 text-2xl text-[var(--app-text)]">{slugify(slug) || "tenant-slug"}</p>
                  <p className="app-text-soft mt-2 text-sm">This value is used as the stable tenant identifier in the platform.</p>
                </div>

                <div className="app-panel-soft rounded-[18px] p-5">
                  <p className="text-sm text-[var(--app-text)]">Next step</p>
                  <p className="app-text-soft mt-3 text-sm">
                    After saving, open the tenant workspace you want to manage and add the first server under that tenant.
                  </p>
                </div>
              </div>
            </div>
          </form>

          <section className="mt-8 rounded-[22px] bg-[#1a212e] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[28px] leading-none text-[#f2f5fa]">Tenant List</h2>
                <p className="mt-3 text-sm text-[#8c9eba]">
                  Review all tenants and choose which workspace should be active for your admin session.
                </p>
              </div>
              <button
                type="button"
                onClick={loadTenants}
                className="h-11 rounded-xl border border-[#262e3d] bg-[#151d29] px-5 text-sm text-[#dce3f0] hover:bg-[#202939]"
              >
                Refresh List
              </button>
            </div>

            {isLoadingTenants ? (
              <p className="mt-6 rounded-2xl border border-[#262e3d] bg-[#171c26] p-4 text-sm text-[#8c9eba]">
                Loading tenants...
              </p>
            ) : null}

            {!isLoadingTenants && tenantRows.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-[#262e3d] bg-[#171c26] p-4 text-sm text-[#8c9eba]">
                No tenants yet. Create the first tenant above to start managing workspaces.
              </p>
            ) : null}

            {!isLoadingTenants && tenantRows.length > 0 ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-[#262e3d]">
                <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.9fr] gap-3 bg-[#151d29] px-5 py-3 text-xs text-[#8c9eba] md:grid">
                  <span>Tenant</span>
                  <span>Slug</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                <div className="divide-y divide-[#262e3d]">
                  {tenantRows.map((tenant) => {
                    const isActive = activeTenantId === tenant.id;

                    return (
                      <article
                        key={tenant.id}
                        className="bg-[#171c26] px-5 py-4 md:grid md:grid-cols-[1.4fr_1fr_0.8fr_0.9fr] md:items-center md:gap-3"
                      >
                        <div>
                          <p className="text-base text-[#f2f5fa]">{tenant.name}</p>
                          <p className="mt-1 text-sm text-[#8c9eba] md:hidden">{tenant.slug}</p>
                        </div>

                        <p className="mt-3 text-sm text-[#8c9eba] md:mt-0 md:block">{tenant.slug}</p>

                        <div className="mt-3 md:mt-0">
                          <span className="inline-flex rounded-full border border-[#244530] bg-[#244530] px-3 py-1 text-xs text-[#bff2c7]">
                            {tenant.status}
                          </span>
                          {isActive ? (
                            <span className="ml-2 inline-flex rounded-full border border-[#24344c] bg-[#24344c] px-3 py-1 text-xs text-[#cfe1ff]">
                              active
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 md:mt-0 md:flex md:justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenTenant(tenant.id)}
                            className="h-10 rounded-xl bg-[#c98a00] px-5 text-sm text-[#f2f5fa] hover:brightness-110"
                          >
                            Open Workspace
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </WorkspaceContainer>
        )}
      </main>
    </div>
  );
}
