"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { classifyIp } from "@/components/servers/monitoring-connectivity-check";
import { getCurrentUser, type UserRole } from "@/services/authService";
import { showToast } from "@/components/ui/toast";
import {
  createServer,
  listTenants,
  saveManagedServerMetricsEndpoints,
  type TenantResponse,
} from "@/services/workspaceService";

export const dynamic = "force-dynamic";

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

function toInstanceAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function Toggle({
  checked,
  onToggle,
  accent = "bg-[#fc7342]",
}: {
  checked: boolean;
  onToggle: () => void;
  accent?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${checked ? accent : "bg-[#262e3d]"}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-[#f2f5fa] transition ${checked ? "translate-x-[26px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}

function parsePortInput(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }

  return parsed;
}

export default function CreateServerPage() {
  const searchParams = useSearchParams();
  const tenantIdFromQuery = searchParams.get("tenantId") ?? "";

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantLabel, setTenantLabel] = useState("Current tenant");
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [instance, setInstance] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [dockerEnabled, setDockerEnabled] = useState(true);
  const [nodeExporterPort, setNodeExporterPort] = useState("9100");
  const [cadvisorPort, setCadvisorPort] = useState("8081");
  const [ansibleHost, setAnsibleHost] = useState("");
  const [ansibleUser, setAnsibleUser] = useState("root");
  const [ansibleBecome, setAnsibleBecome] = useState(false);
  const [ansiblePythonInterpreter, setAnsiblePythonInterpreter] = useState("/usr/bin/python3");
  const [billingNote, setBillingNote] = useState("");
  const [billingAmount, setBillingAmount] = useState("");
  const [billingCurrency, setBillingCurrency] = useState("");
  const [billingDueDay, setBillingDueDay] = useState("");
  const [instanceDirty, setInstanceDirty] = useState(false);
  const [ansibleHostDirty, setAnsibleHostDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  useEffect(() => {
    if (instanceDirty) {
      return;
    }

    setInstance(toInstanceAlias(name));
  }, [instanceDirty, name]);

  useEffect(() => {
    if (ansibleHostDirty) {
      return;
    }

    setAnsibleHost(ipAddress.trim());
  }, [ansibleHostDirty, ipAddress]);

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole === "member") {
          setTenants([]);
          return;
        }

        if (normalizedRole === "admin") {
          const tenantRows = await listTenants(accessToken);
          setTenants(tenantRows);

          const storedTenantId = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY) ?? "";
          const resolvedTenantId = tenantIdFromQuery || storedTenantId;
          const matchedTenant = tenantRows.find((tenant) => tenant.id === resolvedTenantId) ?? null;

          if (matchedTenant) {
            setSelectedTenantId(matchedTenant.id);
            setTenantLabel(matchedTenant.name);
            localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, matchedTenant.id);
          } else {
            setSelectedTenantId("");
            setTenantLabel("Choose tenant");
          }

          return;
        }

        if (!currentUser.tenantId) {
          throw new Error("No tenant available for current user.");
        }

        setSelectedTenantId(currentUser.tenantId);
        setTenantLabel("Current tenant");
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, currentUser.tenantId);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load server configuration.";
        showToast(message, "error");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPage();
  }, [tenantIdFromQuery]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTenantId) {
      showToast("Select a tenant context before saving the server.", "error");
      return;
    }

    if (!name.trim() || !ipAddress.trim() || !instance.trim() || !ansibleHost.trim() || !ansibleUser.trim()) {
      showToast("Server name, IP address, instance alias, Ansible host, and Ansible user are required.", "error");
      return;
    }

    let normalizedNodeExporterPort = 0;
    let normalizedCadvisorPort = 0;
    try {
      normalizedNodeExporterPort = parsePortInput(nodeExporterPort, "Node exporter port");
      normalizedCadvisorPort = parsePortInput(cadvisorPort, "cAdvisor port");
    } catch (portError) {
      const message = portError instanceof Error ? portError.message : "Invalid monitoring port.";
      showToast(message, "error");
      return;
    }

    if (userRole === "owner") {
      const normalizedBillingNote = billingNote.trim();
      const normalizedBillingAmount = billingAmount.trim();
      const normalizedBillingCurrency = billingCurrency.trim().toUpperCase();
      const normalizedBillingDueDay = billingDueDay.trim();
      const hasAnyBilling =
        normalizedBillingNote !== "" ||
        normalizedBillingAmount !== "" ||
        normalizedBillingCurrency !== "" ||
        normalizedBillingDueDay !== "";

      if (hasAnyBilling) {
        if (!normalizedBillingNote || !normalizedBillingAmount || !normalizedBillingCurrency || !normalizedBillingDueDay) {
          showToast("Billing note, amount, currency, and due day are required together.", "error");
          return;
        }

        const parsedAmount = Number(normalizedBillingAmount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          showToast("Billing amount must be greater than zero.", "error");
          return;
        }

        const parsedDueDay = Number(normalizedBillingDueDay);
        if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 28) {
          showToast("Billing due day must be an integer between 1 and 28.", "error");
          return;
        }

        if (!/^[A-Z]{3}$/.test(normalizedBillingCurrency)) {
          showToast("Billing currency must be a 3-letter code like USD.", "error");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const createdServer = await createServer("", selectedTenantId, {
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        instance: instance.trim(),
        environment,
        dockerEnabled,
        ansibleHost: ansibleHost.trim(),
        ansibleUser: ansibleUser.trim(),
        ansibleBecome,
        ansiblePythonInterpreter: ansiblePythonInterpreter.trim(),
        billingNote: userRole === "owner" && billingNote.trim() ? billingNote.trim() : null,
        billingAmount: userRole === "owner" && billingAmount.trim() ? Number(billingAmount.trim()) : null,
        billingCurrency:
          userRole === "owner" && billingCurrency.trim()
            ? billingCurrency.trim().toUpperCase()
            : null,
        billingDueDay: userRole === "owner" && billingDueDay.trim() ? Number(billingDueDay.trim()) : null,
      });

      localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, selectedTenantId);

      try {
        await saveManagedServerMetricsEndpoints("", selectedTenantId, createdServer, {
          nodeExporterPort: normalizedNodeExporterPort,
          cadvisorPort: normalizedCadvisorPort,
        });
      } catch {
        showToast(
          `Server ${name.trim()} was created, but monitoring ports could not be saved. Open the server edit page and retry.`,
          "error",
        );
        return;
      }

      showToast(
        `Server ${name.trim()} created${selectedTenant ? ` for ${selectedTenant.name}` : ""}. You can return to the workspace and trigger onboarding next.`,
        "success",
      );
      setName("");
      setIpAddress("");
      setInstance("");
      setEnvironment("development");
      setDockerEnabled(true);
      setNodeExporterPort("9100");
      setCadvisorPort("8081");
      setAnsibleHost("");
      setAnsibleUser("root");
      setAnsibleBecome(false);
      setAnsiblePythonInterpreter("/usr/bin/python3");
      setBillingNote("");
      setBillingAmount("");
      setBillingCurrency("");
      setBillingDueDay("");
      setInstanceDirty(false);
      setAnsibleHostDirty(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to create server.";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading server configuration...</p>
        </main>
      </div>
    );
  }

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const canConfigureServers = userRole === "admin" || userRole === "owner";
  const selectedTenantName = userRole === "admin" ? selectedTenant?.name ?? "Choose tenant" : tenantLabel;
  const selectedTenantDetailLines =
    userRole === "admin"
      ? selectedTenant
        ? [selectedTenant.slug, "Trigger onboarding next"]
        : ["No tenant context selected", "Pick a tenant before saving"]
      : ["Save SSH-ready", "Trigger onboarding next"];

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Servers"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Workflow" : "Workflow",
            name: userRole === "admin" ? "Create server" : "Create server",
            serversCount: 0,
            onboardingRunning: 0,
            detailLines: selectedTenantDetailLines,
          }}
        />

        {!canConfigureServers ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Restricted area</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Members can inspect the workspace but cannot register new servers.
            </p>
            <Link
              href="/dashboard"
              className="app-button-secondary mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
            >
              Back to Workspace
            </Link>
          </section>
        ) : userRole === "admin" && tenants.length === 0 ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Create Server</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Create a tenant first. Servers are tenant-scoped, so the admin flow needs tenant context before onboarding fields can be saved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tenants/create"
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium hover:brightness-110"
              >
                Create Tenant
              </Link>
              <Link
                href="/tenants"
                className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
              >
                Open Tenant Directory
              </Link>
            </div>
          </section>
        ) : (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]" data-node-id="50:2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Create Server</h1>
                <p className="app-text-soft mt-3 max-w-[720px] text-[15px] leading-[22px]">
                  Register a new server with monitoring identity and SSH onboarding configuration.
                </p>
                <p className="app-text-soft mt-4 text-[13px] font-medium uppercase tracking-[0.18em]">
                  Tenant context: <span className="text-[var(--app-text)]">{selectedTenantName}</span>
                </p>
              </div>

              <button
                type="submit"
                form="create-server-form"
                disabled={isSubmitting}
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-[14px] px-7 text-sm font-medium hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Save Server"}
              </button>
            </div>

            <section className="mt-8 rounded-[22px] bg-[#1a212e] p-6">
              <h2 className="text-[18px] text-[#f2f5fa]">Before you save</h2>
              <p className="mt-2 text-[14px] leading-[20px] text-[#8c9eba]">
                This screen stores both product metadata and the SSH fields used by backend onboarding.
              </p>
              <div className="mt-6 space-y-4 text-[14px] leading-[20px] text-[#8c9eba]">
                <p className="flex gap-4">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-[#fc7342]" />
                  <span>Instance should be a clean alias like dev-server-1, not ip:port.</span>
                </p>
                <p className="flex gap-4">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-[#fc7342]" />
                  <span>Ansible host should be the SSH target, usually the same as the server IP.</span>
                </p>
                <p className="flex gap-4">
                  <span className="mt-[6px] h-2 w-2 rounded-full bg-[#fc7342]" />
                  <span>Docker enabled should reflect whether container monitoring and logs are expected.</span>
                </p>
              </div>
            </section>

            <form id="create-server-form" onSubmit={handleSubmit} className="mt-8 rounded-[22px] bg-[#1a212e] p-6">
              <h2 className="text-[18px] text-[#f2f5fa]">Server Configuration</h2>
              <p className="mt-2 text-[14px] leading-[20px] text-[#8c9eba]">
                Everything on this form maps directly to backend fields already used by onboarding and logs.
              </p>

              <div className="mt-10">
                <p className="text-[15px] text-[#f2f5fa]">Basic Info</p>
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  {userRole === "admin" ? (
                    <label className="block">
                      <span className="text-[13px] text-[#8c9eba]">Tenant</span>
                      <select
                        value={selectedTenantId}
                        onChange={(event) => setSelectedTenantId(event.target.value)}
                        className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                      >
                        <option value="">Select tenant</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Server name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Hetzner Dev Server"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">IP address</span>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(event) => setIpAddress(event.target.value)}
                      placeholder="46.62.230.113"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                    {["private", "loopback", "link-local"].includes(classifyIp(ipAddress)) ? (
                      <p className="mt-2 text-[13px] leading-[18px] text-[#f4c87a]">
                        This looks like a private/internal IP. Prometheus must reach it over the
                        network, so use the public IP or configure NAT/VPN.
                      </p>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Instance alias</span>
                    <input
                      type="text"
                      value={instance}
                      onChange={(event) => {
                        setInstanceDirty(true);
                        setInstance(event.target.value);
                      }}
                      placeholder="dev-server-1"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Environment</span>
                    <select
                      value={environment}
                      onChange={(event) => setEnvironment(event.target.value)}
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                    >
                      <option value="development">development</option>
                      <option value="staging">staging</option>
                      <option value="production">production</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[15px] text-[#f2f5fa]">Monitoring Settings</p>
                <div className="mt-6 rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[14px] text-[#8c9eba]">Docker enabled</p>
                      <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                        Required when you expect cadvisor metrics and container logs.
                      </p>
                    </div>
                    <Toggle checked={dockerEnabled} onToggle={() => setDockerEnabled((current) => !current)} />
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Node exporter port</span>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      step="1"
                      value={nodeExporterPort}
                      onChange={(event) => setNodeExporterPort(event.target.value)}
                      placeholder="9100"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                    <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                      Port used by Prometheus to scrape node exporter for this server.
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">cAdvisor port</span>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      step="1"
                      value={cadvisorPort}
                      onChange={(event) => setCadvisorPort(event.target.value)}
                      placeholder="8081"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                    <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                      Stored per server. When Docker is off, the endpoint stays disabled until Docker is enabled.
                    </p>
                  </label>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[15px] text-[#f2f5fa]">SSH / Onboarding Settings</p>
                <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1fr_1.08fr]">
                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Ansible host</span>
                    <input
                      type="text"
                      value={ansibleHost}
                      onChange={(event) => {
                        setAnsibleHostDirty(true);
                        setAnsibleHost(event.target.value);
                      }}
                      placeholder="46.62.230.113"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Ansible user</span>
                    <input
                      type="text"
                      value={ansibleUser}
                      onChange={(event) => setAnsibleUser(event.target.value)}
                      placeholder="root"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] text-[#8c9eba]">Python interpreter</span>
                    <input
                      type="text"
                      value={ansiblePythonInterpreter}
                      onChange={(event) => setAnsiblePythonInterpreter(event.target.value)}
                      placeholder="/usr/bin/python3"
                      className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                    />
                  </label>
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_272px]">
                  <div className="rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] text-[#8c9eba]">Ansible become</p>
                        <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                          Enable when the SSH user needs sudo for installation.
                        </p>
                      </div>
                      <Toggle checked={ansibleBecome} onToggle={() => setAnsibleBecome((current) => !current)} accent="bg-[#364154]" />
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
                    <p className="text-[13px] font-medium text-[#f2f5fa]">Next step</p>
                    <p className="mt-3 text-[13px] leading-[18px] text-[#8c9eba]">
                      After saving, open the workspace and trigger Install Monitoring.
                    </p>
                    <Link
                      href="/dashboard"
                      className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-[#263246] bg-[#151d29] px-4 text-sm text-[#f8f8f8] hover:bg-[#1c2633]"
                    >
                      Open Workspace
                    </Link>
                  </div>
                </div>
              </div>

              {userRole === "owner" ? (
                <div className="mt-8">
                  <p className="text-[15px] text-[#f2f5fa]">Billing Reminder (Owner)</p>
                  <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                    Optional. If filled, all fields are required and Telegram reminders will be sent 3 days and 1 day before due date.
                  </p>
                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    <label className="block xl:col-span-2">
                      <span className="text-[13px] text-[#8c9eba]">Billing note</span>
                      <textarea
                        value={billingNote}
                        onChange={(event) => setBillingNote(event.target.value)}
                        placeholder="Cloud VPS payment for this server"
                        rows={3}
                        className="mt-3 w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 py-3 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[13px] text-[#8c9eba]">Monthly amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingAmount}
                        onChange={(event) => setBillingAmount(event.target.value)}
                        placeholder="12.50"
                        className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[13px] text-[#8c9eba]">Currency</span>
                      <input
                        type="text"
                        maxLength={3}
                        value={billingCurrency}
                        onChange={(event) => setBillingCurrency(event.target.value.toUpperCase())}
                        placeholder="USD"
                        className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] uppercase text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[13px] text-[#8c9eba]">Due day (1-28)</span>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        step="1"
                        value={billingDueDay}
                        onChange={(event) => setBillingDueDay(event.target.value)}
                        placeholder="1"
                        className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff]"
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
