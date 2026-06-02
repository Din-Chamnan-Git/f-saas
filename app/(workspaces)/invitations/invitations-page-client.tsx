"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import { createTenantOwner, listTenants, type TenantResponse } from "@/services/workspaceService";

export const dynamic = "force-dynamic";

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

function buildEmailFromName(value: string, slug: string) {
  const localPart = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (!localPart) {
    return "";
  }

  return `${localPart}@${slug || "tenant"}.local`;
}

function createTemporaryPassword() {
  const token = Math.random().toString(36).slice(-6);
  return `Owner!${token}9`;
}

export default function InvitationsPage() {
  const searchParams = useSearchParams();
  const preselectedTenantId = searchParams.get("tenantId") ?? "";

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(preselectedTenantId);
  const [temporaryPassword, setTemporaryPassword] = useState(() => createTemporaryPassword());
  const [emailDirty, setEmailDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole !== "admin") {
          setTenants([]);
          return;
        }

        const tenantRows = await listTenants(accessToken);
        setTenants(tenantRows);

        if (!preselectedTenantId && tenantRows[0]) {
          setSelectedTenantId(tenantRows[0].id);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load owner provisioning.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPage();
  }, [preselectedTenantId]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  useEffect(() => {
    if (!selectedTenant || emailDirty) {
      return;
    }

    setEmail(buildEmailFromName(fullName, selectedTenant.slug));
  }, [emailDirty, fullName, selectedTenant]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!selectedTenant) {
      setError("Select a tenant before sending the owner invite.");
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email address are required.");
      return;
    }

    if (!temporaryPassword.trim()) {
      setError("Temporary password is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const owner = await createTenantOwner("", {
        tenantId: selectedTenant.id,
        email: email.trim(),
        password: temporaryPassword.trim(),
        displayName: fullName.trim(),
      });
      setSuccessMessage(
        `Owner account created for ${owner.displayName} under ${selectedTenant.name}. The account can now sign in with the temporary password and should change it after first login.`,
      );
      setFullName("");
      setEmail("");
      setEmailDirty(false);
      setTemporaryPassword(createTemporaryPassword());
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to create owner account.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading owner provisioning...</p>
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
          activeItem={userRole === "admin" ? "Owners" : "Servers"}
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Provisioning Flow" : "Active Tenant",
            name: userRole === "admin" ? selectedTenant?.name ?? "Choose tenant" : "Current tenant",
            serversCount: 0,
            onboardingRunning: 0,
            detailLines:
              userRole === "admin"
                ? [
                    selectedTenant ? `${selectedTenant.slug}` : "No tenant selected",
                    successMessage ? "Owner account ready" : "Owner account pending",
                  ]
                : undefined,
          }}
        />

        {userRole !== "admin" ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Admin-only area</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Owner provisioning belongs to platform admins. Owner and member users should stay scoped to the workspace.
            </p>
            <Link
              href="/dashboard"
              className="app-button-secondary mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
            >
              Back to Workspace
            </Link>
          </section>
        ) : (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]" data-node-id="133:240">
            <div className="inline-flex rounded-full bg-[#553819] px-3 py-1 text-[11px] font-medium text-[#ffd09a]">
              ADMIN CONSOLE
            </div>

            <h1 className="mt-4 text-[30px] font-semibold leading-tight text-[var(--app-text)]">Create Owner</h1>
            <p className="app-text-soft mt-2 max-w-[640px] text-[14px] leading-[20px]">
              Create a tenant owner account. The owner is scoped to a single tenant and manages that tenant&apos;s resources.
            </p>

            <section className="app-card mt-6 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-[#22313f] grid place-items-center text-sm text-[#9ec4ff]">i</div>
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text)]">Before you create</p>
                  <p className="app-text-soft mt-1 text-[13px]">Owner accounts are tenant-scoped. Use platform operators for cross-tenant access.</p>
                </div>
              </div>
            </section>

            <form onSubmit={handleSubmit} className="app-card mt-6 rounded-xl p-4">
              <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Owner configuration</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="app-text-soft text-[13px] font-medium">Full name</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Owner full name"
                    className="app-input mt-2 h-12 w-full rounded-xl px-4 text-[14px] outline-none focus:border-[#5cb7ff]"
                  />
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px] font-medium">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmailDirty(true);
                      setEmail(event.target.value);
                    }}
                    placeholder="owner@company.local"
                    className="app-input mt-2 h-12 w-full rounded-xl px-4 text-[14px] outline-none focus:border-[#5cb7ff]"
                  />
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px] font-medium">Tenant</span>
                  <select
                    value={selectedTenantId}
                    onChange={(event) => setSelectedTenantId(event.target.value)}
                    className="app-input mt-2 h-12 w-full rounded-xl px-4 text-[14px] outline-none focus:border-[#5cb7ff]"
                  >
                    <option value="" disabled>
                      Select tenant
                    </option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px] font-medium">Role</span>
                  <input
                    type="text"
                    value="owner"
                    readOnly
                    className="app-input mt-2 h-12 w-full rounded-xl px-4 text-[14px] outline-none"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="app-text-soft text-[13px] font-medium">Temporary password</span>
                  <input
                    type="text"
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    placeholder="Temporary password"
                    className="app-input mt-2 h-12 w-full rounded-xl px-4 text-[14px] outline-none focus:border-[#5cb7ff]"
                  />
                </label>
              </div>

              {error ? <p className="mt-4 text-sm text-[#ff9b7a]">{error}</p> : null}
              {successMessage ? <p className="mt-4 text-sm text-[#bff2c7]">{successMessage}</p> : null}

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="app-button-primary inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Creating..." : "Create Owner"}
                </button>
                <Link
                  href="/tenants"
                  className="app-button-secondary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
