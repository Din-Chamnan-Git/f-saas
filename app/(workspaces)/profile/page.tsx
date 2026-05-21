"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, logoutCurrentUser, type CurrentUser, type UserRole } from "@/services/authService";
import { listTenants } from "@/services/workspaceService";

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

function ProfileField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="app-panel-soft rounded-[18px] px-5 py-4">
      <p className="app-text-soft text-[13px]">{label}</p>
      <p className={`mt-2 text-[15px] ${muted ? "text-[var(--app-text-soft)]" : "text-[var(--app-text)]"}`}>{value}</p>
    </div>
  );
}

function getSessionLabel() {
  if (typeof window === "undefined") {
    return "Unknown";
  }

  return "Secure cookie session";
}

export default function ProfilePage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTenantCount, setActiveTenantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = "";
        const user = await getCurrentUser(accessToken);
        const normalizedRole = user.role.toLowerCase() as UserRole;

        if (normalizedRole === "admin") {
          const tenants = await listTenants(accessToken);
          setActiveTenantCount(tenants.filter((tenant) => tenant.status.toLowerCase() === "active").length);
        }

        setCurrentUser(user);
        setUserRole(normalizedRole);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load profile.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      await logoutCurrentUser();
      router.replace("/login");
    } catch (logoutError) {
      const message = logoutError instanceof Error ? logoutError.message : "Unable to sign out.";
      setError(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading profile...</p>
        </main>
      </div>
    );
  }

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const workspaceHref = userRole === "admin" ? "/dashboard" : "/dashboard";
  const tenantScopeLabel = currentUser?.tenantId
    ? `Assigned company id: ${currentUser.tenantId}`
    : "Platform-scoped account";
  const sidebarScope =
    userRole === "admin"
      ? {
          label: "Platform Scope",
          name: "All tenants",
          serversCount: 0,
          onboardingRunning: 0,
          detailLines: [`${activeTenantCount} active tenants`, "0 platform alerts"],
        }
      : {
          label: "Tenant Scope",
          name: currentUser?.tenantId ? "Assigned tenant" : "Workspace scope",
          serversCount: 0,
          onboardingRunning: 0,
          detailLines: [tenantScopeLabel, currentUser?.email ?? "Unknown email"],
        };

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Profile"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={sidebarScope}
        />

        <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
          <div className="inline-flex rounded-full bg-[#243244] px-4 py-1 text-[12px] font-medium text-[#b7d6ff]">
            ACCOUNT
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Profile</h1>
              <p className="app-text-soft mt-3 max-w-[560px] text-[15px] leading-[22px]">
                Your account details and session status.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={workspaceHref}
                className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
              >
                Back to Workspace
              </Link>
              <button
                type="button"
                onClick={() => {
                  void handleSignOut();
                }}
                disabled={isSigningOut}
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-[14px] px-7 text-sm font-medium hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>

          {error ? <p className="mt-6 text-sm text-[#ff9b7a]">{error}</p> : null}

          <section className="app-card mt-8 rounded-[22px] p-6">
            <h2 className="text-[20px] font-semibold text-[var(--app-text)]">Account Overview</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ProfileField label="Display name" value={currentUser?.displayName ?? "Unknown"} />
              <ProfileField label="Email address" value={currentUser?.email ?? "Unknown"} />
              <ProfileField label="Role" value={currentUser?.role ?? "Unknown"} />
              <ProfileField label="Account state" value={currentUser?.active ? "Active" : "Inactive"} />
              <ProfileField label="Tenant scope" value={currentUser?.tenantId ?? "Platform-wide account"} muted />
              <ProfileField label="Workspace scope" value={userRole === "admin" ? "Cross-tenant" : "Single-tenant"} />
              <ProfileField label="Login mode" value={getSessionLabel()} />
              <ProfileField label="User id" value={currentUser?.userId ?? "Unknown"} muted />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
