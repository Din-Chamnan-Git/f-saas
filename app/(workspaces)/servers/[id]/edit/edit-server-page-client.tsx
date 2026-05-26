"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import { showToast } from "@/components/ui/toast";
import {
  getServer,
  listTenants,
  listServerMetricsEndpoints,
  saveManagedServerMetricsEndpoints,
  updateServer,
  type TenantResponse,
} from "@/services/workspaceService";

export const dynamic = "force-dynamic";

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

export default function EditServerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serverId = typeof params?.id === "string" ? params.id : "";
  const tenantIdFromQuery = searchParams.get("tenantId") ?? "";

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [requestTenantId, setRequestTenantId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole === "member") {
          throw new Error("Members cannot edit servers.");
        }

        let resolvedTenantId = tenantIdFromQuery;
        if (normalizedRole === "admin") {
          const tenantRows = await listTenants(accessToken);
          setTenants(tenantRows);
        } else if (!resolvedTenantId && currentUser.tenantId) {
          resolvedTenantId = currentUser.tenantId;
        }

        if (!resolvedTenantId) {
          throw new Error("Tenant id is required to edit this server.");
        }

        setRequestTenantId(resolvedTenantId);
        const [server, endpointRows] = await Promise.all([
          getServer(accessToken, resolvedTenantId, serverId),
          listServerMetricsEndpoints(accessToken, resolvedTenantId, serverId).catch(() => []),
        ]);
        const endpointByType = new Map(endpointRows.map((endpoint) => [endpoint.endpointType, endpoint]));

        setSelectedTenantId(server.tenantId);
        setName(server.name);
        setIpAddress(server.ipAddress);
        setInstance(server.instance);
        setEnvironment(server.environment);
        setDockerEnabled(server.dockerEnabled);
        setNodeExporterPort(String(endpointByType.get("node_exporter")?.port ?? 9100));
        setCadvisorPort(String(endpointByType.get("cadvisor")?.port ?? 8081));
        setAnsibleHost(server.ansibleHost);
        setAnsibleUser(server.ansibleUser);
        setAnsibleBecome(server.ansibleBecome);
        setAnsiblePythonInterpreter(server.ansiblePythonInterpreter ?? "");
        setBillingNote(server.billingNote ?? "");
        setBillingAmount(server.billingAmount == null ? "" : String(server.billingAmount));
        setBillingCurrency(server.billingCurrency ?? "");
        setBillingDueDay(server.billingDueDay == null ? "" : String(server.billingDueDay));
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load server.";
        showToast(message, "error");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPage();
  }, [serverId, tenantIdFromQuery]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTenantId) {
      showToast("Tenant selection is required.", "error");
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
      const updatedServer = await updateServer("", requestTenantId, serverId, {
        tenantId: userRole === "admin" ? selectedTenantId : undefined,
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        instance: instance.trim(),
        environment,
        dockerEnabled,
        ansibleHost: ansibleHost.trim(),
        ansibleUser: ansibleUser.trim(),
        ansibleBecome,
        ansiblePythonInterpreter: ansiblePythonInterpreter.trim(),
        billingNote: billingNote.trim() ? billingNote.trim() : null,
        billingAmount: billingAmount.trim() ? Number(billingAmount.trim()) : null,
        billingCurrency: billingCurrency.trim() ? billingCurrency.trim().toUpperCase() : null,
        billingDueDay: billingDueDay.trim() ? Number(billingDueDay.trim()) : null,
      });

      setRequestTenantId(updatedServer.tenantId);
      setSelectedTenantId(updatedServer.tenantId);

      try {
        await saveManagedServerMetricsEndpoints("", updatedServer.tenantId, updatedServer, {
          nodeExporterPort: normalizedNodeExporterPort,
          cadvisorPort: normalizedCadvisorPort,
        });
      } catch {
        showToast(
          `Server ${name.trim()} was updated, but monitoring ports could not be saved. Open the server edit page and retry.`,
          "error",
        );
        return;
      }

      const successMsg =
        updatedServer.tenantId === requestTenantId
          ? `Server ${name.trim()} updated successfully.`
          : `Server ${name.trim()} moved to ${selectedTenant?.name ?? "the selected tenant"} and updated successfully.`;
      showToast(successMsg, "success");
      router.replace(`/servers/${serverId}/edit?tenantId=${updatedServer.tenantId}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to update server.";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="app-text-soft text-sm">Loading server...</p>
        </main>
      </div>
    );
  }

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const selectedTenantName = userRole === "admin" ? selectedTenant?.name ?? "Selected tenant" : "Current tenant";
  const canEditBilling = userRole === "owner";

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Servers"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: "Workflow",
            name: "Edit server",
            serversCount: 0,
            onboardingRunning: 0,
            detailLines: [selectedTenantName, "Update server configuration"],
          }}
        />

        <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Edit Server</h1>
              <p className="app-text-soft mt-3 max-w-[720px] text-[15px] leading-[22px]">
                Update monitoring identity and SSH onboarding settings for this server.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/servers"
                className="app-button-secondary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
              >
                Back to Servers
              </Link>
              <button
                type="submit"
                form="edit-server-form"
                disabled={isSubmitting}
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-[14px] px-7 text-sm font-medium hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <form id="edit-server-form" onSubmit={handleSubmit} className="app-card mt-8 rounded-[22px] p-6">
            <h2 className="text-[18px] text-[var(--app-text)]">Server Configuration</h2>

            <div className="mt-10 grid gap-6 xl:grid-cols-2">
              {userRole === "admin" ? (
                <label className="block xl:col-span-2">
                  <span className="text-[13px] text-[#8c9eba]">Company</span>
                  <select
                    value={selectedTenantId}
                    onChange={(event) => setSelectedTenantId(event.target.value)}
                    className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                  >
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-3 text-[13px] leading-[18px] text-[#8c9eba]">
                    Changing company transfers this server to a different tenant. Only admin can do this.
                  </p>
                </label>
              ) : null}

              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">Server name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
              </label>

              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">IP address</span>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(event) => setIpAddress(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
              </label>

              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">Instance alias</span>
                <input
                  type="text"
                  value={instance}
                  onChange={(event) => setInstance(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
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

            <div className="mt-8 rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
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
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
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
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
                <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                  Stored per server and kept even if Docker is temporarily disabled.
                </p>
              </label>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr_1.08fr]">
              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">Ansible host</span>
                <input
                  type="text"
                  value={ansibleHost}
                  onChange={(event) => setAnsibleHost(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
              </label>

              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">Ansible user</span>
                <input
                  type="text"
                  value={ansibleUser}
                  onChange={(event) => setAnsibleUser(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
              </label>

              <label className="block">
                <span className="text-[13px] text-[#8c9eba]">Python interpreter</span>
                <input
                  type="text"
                  value={ansiblePythonInterpreter}
                  onChange={(event) => setAnsiblePythonInterpreter(event.target.value)}
                  className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none focus:border-[#5cb7ff]"
                />
              </label>
            </div>

            <div className="mt-6 rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
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

            <div className="mt-8 rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
              <p className="text-[15px] text-[#f2f5fa]">Billing Reminder</p>
              <p className="mt-2 text-[13px] leading-[18px] text-[#8c9eba]">
                {canEditBilling
                  ? "Set monthly VPS payment info. Telegram reminders will go out 3 days and 1 day before due date."
                  : "Only tenant owner can edit billing note and reminder settings. You can still view current values."}
              </p>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <label className="block xl:col-span-2">
                  <span className="text-[13px] text-[#8c9eba]">Billing note</span>
                  <textarea
                    value={billingNote}
                    onChange={(event) => setBillingNote(event.target.value)}
                    rows={3}
                    disabled={!canEditBilling}
                    placeholder="Cloud VPS monthly payment"
                    className="mt-3 w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 py-3 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff] disabled:cursor-not-allowed disabled:opacity-70"
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
                    disabled={!canEditBilling}
                    placeholder="12.50"
                    className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>

                <label className="block">
                  <span className="text-[13px] text-[#8c9eba]">Currency</span>
                  <input
                    type="text"
                    maxLength={3}
                    value={billingCurrency}
                    onChange={(event) => setBillingCurrency(event.target.value.toUpperCase())}
                    disabled={!canEditBilling}
                    placeholder="USD"
                    className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] uppercase text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff] disabled:cursor-not-allowed disabled:opacity-70"
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
                    disabled={!canEditBilling}
                    placeholder="1"
                    className="mt-3 h-[54px] w-full rounded-[14px] border border-[#262e3d] bg-[#171c26] px-5 text-[14px] text-[#f2f5fa] outline-none placeholder:text-[#b8c4d6] focus:border-[#5cb7ff] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
