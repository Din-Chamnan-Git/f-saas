"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getServerLogs,
  listTenantServers,
  listTenants,
  type LogEntryResponse,
  type ServerLogsResponse,
  type ServerResponse,
  type TenantResponse,
} from "@/services/workspaceService";

export const dynamic = "force-dynamic";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const RANGE_OPTIONS = ["15m", "1h", "6h", "24h", "7d"] as const;
const LIMIT_OPTIONS = [100, 200, 500, 1000] as const;
const REFRESH_OPTIONS = [
  { value: "manual", label: "Manual", intervalMs: null },
  { value: "15s", label: "15s", intervalMs: 15_000 },
  { value: "30s", label: "30s", intervalMs: 30_000 },
  { value: "1m", label: "1m", intervalMs: 60_000 },
] as const;
const LOGS_PREFERENCES_STORAGE_KEY = "logsWorkspacePreferences";

type ToolbarControl = "tenant" | "server" | "range" | "refresh" | "limit";
type RefreshOption = (typeof REFRESH_OPTIONS)[number];
type ToolbarOption = {
  value: string;
  label: string;
  description?: string;
};
type LogsPreferences = {
  selectedTenantId?: string;
  selectedServerIdByTenant?: Record<string, string>;
  selectedRange?: (typeof RANGE_OPTIONS)[number];
  selectedRefresh?: RefreshOption["value"];
  selectedLimit?: number;
};

const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
  Metrics: "/metrics",
  Logs: "/logs",
};

const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
  Metrics: "/metrics",
  Logs: "/logs",
};

function readLogsPreferences(): LogsPreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LOGS_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as LogsPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLogsPreferences(update: (current: LogsPreferences) => LogsPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const nextValue = update(readLogsPreferences());
  window.localStorage.setItem(LOGS_PREFERENCES_STORAGE_KEY, JSON.stringify(nextValue));
}

function formatRefreshTimestamp(value: Date | null) {
  if (!value) {
    return "Not refreshed yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatLogTimestamp(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function ToolbarChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#283342] bg-[#131922] px-3 py-2">
      <p className="text-[10px] tracking-[0.18em] text-[#687991]">{label}</p>
      <p className="mt-0.5 text-sm text-[#f2f5fa]">{value}</p>
    </div>
  );
}

function ToolbarSelector({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  options: ToolbarOption[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (nextValue: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`flex h-12 min-w-[120px] w-full items-center justify-between rounded-xl border px-4 text-left transition ${
          disabled
            ? "cursor-not-allowed border-[#222a36] bg-[#10151c] text-[#536277]"
            : isOpen
              ? "border-[#415673] bg-[#17202b] text-[#f2f5fa]"
              : "border-[#2a3443] bg-[#151b24] text-[#f2f5fa] hover:border-[#3c4d64]"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.18em] text-[#687991]">{label}</p>
          <p className="mt-0.5 truncate text-sm">{value}</p>
        </div>
        <span className={`ml-4 text-xs text-[#8ea0bb] transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-full min-w-[220px] overflow-hidden rounded-2xl border border-[#2b3544] bg-[#131922] shadow-[0_20px_50px_rgba(3,6,14,0.45)]">
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const isActive = option.value === value;

              return (
                <button
                  key={`${label}-${option.value}`}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                    isActive ? "bg-[#1c2531] text-[#f2f5fa]" : "text-[#d4deed] hover:bg-[#18202a]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{option.label}</p>
                    {option.description ? <p className="mt-1 text-xs text-[#7688a2]">{option.description}</p> : null}
                  </div>
                  {isActive ? <span className="text-xs text-[#c98a00]">●</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#2a3443] bg-[linear-gradient(180deg,#171d26_0%,#11161e_100%)] shadow-[0_18px_45px_rgba(4,8,16,0.28)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#222b38] px-4 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-[#6e7f97]">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-[#8ea0bb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LogRow({ entry }: { entry: LogEntryResponse }) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#253041] bg-[#10161f] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-[#304054] bg-[#16202b] px-2.5 py-1 font-mono text-[#9ec4ff]">
          {formatLogTimestamp(entry.timestamp)}
        </span>
        <span className="rounded-full border border-[#304054] bg-[#171f28] px-2.5 py-1 text-[#c8d6ea]">
          {entry.containerName || "server"}
        </span>
        <span className="rounded-full border border-[#3b3320] bg-[#2b2518] px-2.5 py-1 text-[#ffcf8a]">
          {entry.logStream || "stdout"}
        </span>
        {entry.containerId ? <span className="font-mono text-[#667890]">{entry.containerId.slice(0, 12)}</span> : null}
      </div>
      <pre className="mt-3 max-w-full overflow-hidden whitespace-pre-wrap break-all font-mono text-[12px] leading-6 text-[#d7e0ee]">
        {entry.message}
      </pre>
    </article>
  );
}

export default function LogsPage() {
  const minimumRefreshFxMs = 850;
  const searchParams = useSearchParams();
  const preferredTenantId = searchParams.get("tenantId") ?? "";
  const preferredServerId = searchParams.get("serverId") ?? "";
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenantName, setTenantName] = useState("Logs");
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [selectedRange, setSelectedRange] = useState<(typeof RANGE_OPTIONS)[number]>(() => {
    const storedRange = readLogsPreferences().selectedRange;
    return RANGE_OPTIONS.includes(storedRange ?? "24h") ? (storedRange ?? "24h") : "24h";
  });
  const [selectedRefresh, setSelectedRefresh] = useState<RefreshOption["value"]>(() => {
    const storedRefresh = readLogsPreferences().selectedRefresh;
    return REFRESH_OPTIONS.some((option) => option.value === storedRefresh) ? (storedRefresh ?? "manual") : "manual";
  });
  const [selectedLimit, setSelectedLimit] = useState<number>(() => {
    const storedLimit = readLogsPreferences().selectedLimit;
    return LIMIT_OPTIONS.includes((storedLimit ?? 200) as (typeof LIMIT_OPTIONS)[number]) ? (storedLimit ?? 200) : 200;
  });
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [containerInput, setContainerInput] = useState("");
  const [appliedContainer, setAppliedContainer] = useState("");
  const [logsResponse, setLogsResponse] = useState<ServerLogsResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isRefreshFxActive, setIsRefreshFxActive] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openControl, setOpenControl] = useState<ToolbarControl | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const refreshFxStartedAtRef = useRef(0);
  const refreshFxTimeoutRef = useRef<number | null>(null);
  const refreshFxTokenRef = useRef(0);

  const selectedRefreshOption = useMemo(
    () => REFRESH_OPTIONS.find((option) => option.value === selectedRefresh) ?? REFRESH_OPTIONS[0],
    [selectedRefresh],
  );

  const tenantOptions = useMemo<ToolbarOption[]>(
    () =>
      tenants.map((tenant) => ({
        value: tenant.id,
        label: tenant.name,
        description: tenant.slug,
      })),
    [tenants],
  );

  const serverOptions = useMemo<ToolbarOption[]>(
    () =>
      servers.map((server) => ({
        value: server.id,
        label: server.name,
        description: `${server.ipAddress} • ${server.environment}`,
      })),
    [servers],
  );

  const rangeOptions = useMemo<ToolbarOption[]>(
    () =>
      RANGE_OPTIONS.map((range) => ({
        value: range,
        label: range,
        description: "Loki query window",
      })),
    [],
  );

  const limitOptions = useMemo<ToolbarOption[]>(
    () =>
      LIMIT_OPTIONS.map((limit) => ({
        value: String(limit),
        label: `${limit}`,
        description: "Max log lines returned",
      })),
    [],
  );

  const refreshOptions = useMemo<ToolbarOption[]>(
    () =>
      REFRESH_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.intervalMs ? `Auto refresh every ${option.label}` : "Refresh only when requested",
      })),
    [],
  );

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, servers],
  );

  const containerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const entry of logsResponse?.entries ?? []) {
      if (entry.containerName) {
        names.add(entry.containerName);
      }
    }

    return Array.from(names).sort();
  }, [logsResponse]);

  const logStats = useMemo(() => {
    const entries = logsResponse?.entries ?? [];
    const errorCount = entries.filter((entry) => /error|exception|failed/i.test(entry.message)).length;
    const warnCount = entries.filter((entry) => /\bwarn(ing)?\b/i.test(entry.message)).length;
    const streams = new Set(entries.map((entry) => entry.logStream || "stdout"));

    return {
      total: entries.length,
      errorCount,
      warnCount,
      streamCount: streams.size,
    };
  }, [logsResponse]);

  useEffect(() => {
    if (!openControl) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenControl(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openControl]);

  useEffect(() => {
    return () => {
      if (refreshFxTimeoutRef.current) {
        window.clearTimeout(refreshFxTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const loadContext = async () => {
      setIsLoadingContext(true);
      setError(null);

      try {
        const accessToken = "";
        const currentUser = await getCurrentUser(accessToken);
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole === "admin") {
          const tenantRows = await listTenants(accessToken);
          setTenants(tenantRows);

          if (!tenantRows.length) {
            setSelectedTenantId("");
            setTenantName("No tenant selected");
            return;
          }

          const storedTenantId = readLogsPreferences().selectedTenantId;
          const nextTenantId =
            tenantRows.find((tenant) => tenant.id === preferredTenantId)?.id ??
            tenantRows.find((tenant) => tenant.id === storedTenantId)?.id ??
            tenantRows[0].id;
          setSelectedTenantId(nextTenantId);
          return;
        }

        if (!currentUser.tenantId) {
          throw new Error("No tenant available for current user.");
        }

        setTenantName("Current tenant");
        setSelectedTenantId(currentUser.tenantId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load logs workspace.");
      } finally {
        setIsLoadingContext(false);
      }
    };

    void loadContext();
  }, [preferredTenantId]);

  useEffect(() => {
    const loadServers = async () => {
      if (!selectedTenantId) {
        setServers([]);
        setSelectedServerId("");
        return;
      }

      try {
        const accessToken = "";
        const tenantServers = await listTenantServers(accessToken, selectedTenantId);
        setServers(tenantServers);
        const storedServerId = readLogsPreferences().selectedServerIdByTenant?.[selectedTenantId];
        setSelectedServerId((currentServerId) => {
          if (
            preferredServerId &&
            (!preferredTenantId || preferredTenantId === selectedTenantId) &&
            tenantServers.some((server) => server.id === preferredServerId)
          ) {
            return preferredServerId;
          }

          if (tenantServers.some((server) => server.id === currentServerId)) {
            return currentServerId;
          }

          if (storedServerId && tenantServers.some((server) => server.id === storedServerId)) {
            return storedServerId;
          }

          return tenantServers[0]?.id ?? "";
        });

        const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
        if (selectedTenant) {
          setTenantName(selectedTenant.name);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load tenant servers.");
      }
    };

    void loadServers();
  }, [preferredServerId, preferredTenantId, selectedTenantId, tenants]);

  const loadLogs = useCallback(async () => {
    if (!selectedTenantId || !selectedServerId) {
      setLogsResponse(null);
      return;
    }

    setIsLoadingLogs(true);
    refreshFxTokenRef.current += 1;
    refreshFxStartedAtRef.current = Date.now();
    setIsRefreshFxActive(true);
    if (refreshFxTimeoutRef.current) {
      window.clearTimeout(refreshFxTimeoutRef.current);
      refreshFxTimeoutRef.current = null;
    }
    setError(null);

    try {
      const accessToken = "";
      const nextLogs = await getServerLogs(accessToken, selectedTenantId, selectedServerId, {
        range: selectedRange,
        limit: selectedLimit,
        containerName: appliedContainer,
        search: appliedSearch,
      });

      setLogsResponse(nextLogs);
      setLastRefreshedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load server logs.");
    } finally {
      setIsLoadingLogs(false);
      const refreshFxToken = refreshFxTokenRef.current;
      const elapsedMs = Date.now() - refreshFxStartedAtRef.current;
      const remainingMs = Math.max(0, minimumRefreshFxMs - elapsedMs);

      if (remainingMs === 0) {
        setIsRefreshFxActive(false);
      } else {
        refreshFxTimeoutRef.current = window.setTimeout(() => {
          if (refreshFxTokenRef.current === refreshFxToken) {
            setIsRefreshFxActive(false);
            refreshFxTimeoutRef.current = null;
          }
        }, remainingMs);
      }
    }
  }, [appliedContainer, appliedSearch, selectedLimit, selectedRange, selectedServerId, selectedTenantId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!selectedRefreshOption.intervalMs || !selectedTenantId || !selectedServerId) {
      return;
    }

    const timerId = window.setInterval(() => {
      void loadLogs();
    }, selectedRefreshOption.intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loadLogs, selectedRefreshOption, selectedServerId, selectedTenantId]);

  useEffect(() => {
    writeLogsPreferences((current) => ({
      ...current,
      selectedRange,
      selectedRefresh,
      selectedLimit,
    }));
  }, [selectedLimit, selectedRange, selectedRefresh]);

  useEffect(() => {
    if (!selectedTenantId) {
      return;
    }

    writeLogsPreferences((current) => ({
      ...current,
      selectedTenantId,
    }));
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId || !selectedServerId) {
      return;
    }

    writeLogsPreferences((current) => ({
      ...current,
      selectedServerIdByTenant: {
        ...(current.selectedServerIdByTenant ?? {}),
        [selectedTenantId]: selectedServerId,
      },
    }));
  }, [selectedServerId, selectedTenantId]);

  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const hrefByItem = userRole === "admin" ? adminHrefByItem : tenantHrefByItem;

  if (isLoadingContext) {
    return (
      <div className="min-h-screen w-full bg-[#080d14] text-[#f2f5fa]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <p className="text-sm text-[#8c9eba]">Loading logs workspace...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,#1a2330_0%,#0d131b_30%,#080d14_100%)] text-[#f2f5fa]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Logs"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={hrefByItem}
          tenant={{
            label: userRole === "admin" ? "CURRENT VIEW" : "ACTIVE TENANT",
            name: tenantName,
            serversCount: servers.length,
            onboardingRunning: 0,
            detailLines: selectedServer ? [selectedServer.name, selectedServer.ipAddress] : ["Select a server", "Logs workspace"],
          }}
        />

        <section className="overflow-x-hidden rounded-[28px] border border-[#253041] bg-[linear-gradient(180deg,#131923_0%,#0f141c_100%)] p-5 shadow-[0_22px_55px_rgba(3,6,14,0.34)] md:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-[#fc8f64]">LOGS WORKSPACE</p>
              <h1 className="mt-2 text-[38px] font-semibold leading-none tracking-[-0.05em] text-[#f2f5fa] md:text-[42px]">
                Server Logs
              </h1>
              <p className="mt-3 max-w-[820px] text-sm leading-5 text-[#8ea0bb]">
                Inspect Loki-backed logs per server, narrow by container, and search messages without leaving the workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void loadLogs();
                }}
                className="h-10 rounded-xl bg-[#c98a00] px-4 text-sm text-[#f2f5fa] hover:brightness-110"
              >
                Refresh now
              </button>
              {selectedServer ? (
                <Link
                  href={`/metrics?tenantId=${selectedServer.tenantId}&serverId=${selectedServer.id}`}
                  className="inline-flex h-10 items-center rounded-xl border border-[#2a3443] bg-[#151b24] px-4 text-sm text-[#8ea0bb] hover:border-[#3f5067] hover:text-[#f2f5fa]"
                >
                  Open Metrics
                </Link>
              ) : null}
            </div>
          </div>

          <div ref={toolbarRef} className="mt-6 rounded-2xl border border-[#273241] bg-[#10161f] p-3">
            <div className="grid gap-2.5 xl:grid-cols-[1.15fr_1.15fr_0.7fr_0.7fr_0.7fr_auto]">
              {userRole === "admin" ? (
                <ToolbarSelector
                  label="TENANT"
                  value={tenantOptions.find((option) => option.value === selectedTenantId)?.label ?? "No tenant"}
                  options={tenantOptions}
                  isOpen={openControl === "tenant"}
                  onToggle={() => setOpenControl((current) => (current === "tenant" ? null : "tenant"))}
                  onSelect={(nextValue) => {
                    setSelectedTenantId(nextValue);
                    setOpenControl(null);
                  }}
                  disabled={!tenantOptions.length}
                />
              ) : (
                <ToolbarChip label="TENANT" value={tenantName} />
              )}

              <ToolbarSelector
                label="SERVER"
                value={serverOptions.find((option) => option.value === selectedServerId)?.label ?? "No server"}
                options={serverOptions}
                isOpen={openControl === "server"}
                onToggle={() => setOpenControl((current) => (current === "server" ? null : "server"))}
                onSelect={(nextValue) => {
                  setSelectedServerId(nextValue);
                  setOpenControl(null);
                }}
                disabled={!serverOptions.length}
              />

              <ToolbarSelector
                label="RANGE"
                value={selectedRange}
                options={rangeOptions}
                isOpen={openControl === "range"}
                onToggle={() => setOpenControl((current) => (current === "range" ? null : "range"))}
                onSelect={(nextValue) => {
                  setSelectedRange(nextValue as (typeof RANGE_OPTIONS)[number]);
                  setOpenControl(null);
                }}
              />

              <ToolbarSelector
                label="LIMIT"
                value={String(selectedLimit)}
                options={limitOptions}
                isOpen={openControl === "limit"}
                onToggle={() => setOpenControl((current) => (current === "limit" ? null : "limit"))}
                onSelect={(nextValue) => {
                  setSelectedLimit(Number(nextValue));
                  setOpenControl(null);
                }}
              />

              <ToolbarSelector
                label="REFRESH"
                value={selectedRefreshOption.label}
                options={refreshOptions}
                isOpen={openControl === "refresh"}
                onToggle={() => setOpenControl((current) => (current === "refresh" ? null : "refresh"))}
                onSelect={(nextValue) => {
                  setSelectedRefresh(nextValue as RefreshOption["value"]);
                  setOpenControl(null);
                }}
              />

              <ToolbarChip
                label="STATE"
                value={isLoadingLogs ? "Refreshing logs" : `Updated ${formatRefreshTimestamp(lastRefreshedAt)}`}
              />
            </div>

            <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[1fr_0.8fr_auto]">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search log message"
                className="h-11 rounded-xl border border-[#273241] bg-[#151b24] px-4 text-sm text-[#f2f5fa] outline-none placeholder:text-[#687991] focus:border-[#4f6b8d]"
              />
              <input
                type="text"
                value={containerInput}
                onChange={(event) => setContainerInput(event.target.value)}
                placeholder={containerOptions.length ? `Container e.g. ${containerOptions[0]}` : "Container name (optional)"}
                className="h-11 rounded-xl border border-[#273241] bg-[#151b24] px-4 text-sm text-[#f2f5fa] outline-none placeholder:text-[#687991] focus:border-[#4f6b8d]"
              />
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAppliedSearch(searchInput.trim());
                    setAppliedContainer(containerInput.trim());
                  }}
                  className="h-11 rounded-xl bg-[#c98a00] px-5 text-sm text-[#f2f5fa] hover:brightness-110"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setContainerInput("");
                    setAppliedSearch("");
                    setAppliedContainer("");
                  }}
                  className="h-11 rounded-xl border border-[#2a3443] bg-[#151b24] px-5 text-sm text-[#8ea0bb] hover:border-[#3f5067] hover:text-[#f2f5fa]"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-[#4e2a2a] bg-[#241416] px-4 py-3 text-sm text-[#ffb7b7]">{error}</div>
          ) : null}

          {!selectedTenantId ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#2b3544] bg-[#10161f] px-6 py-12 text-center">
              <p className="text-sm text-[#8ea0bb]">Create or select a tenant before opening logs.</p>
            </div>
          ) : null}

          {selectedTenantId && !servers.length ? (
            <div className="mt-5 rounded-3xl border border-dashed border-[#2b3544] bg-[#10161f] px-6 py-12 text-center">
              <p className="text-sm text-[#8ea0bb]">Add a server under this tenant before trying to inspect logs.</p>
              <Link
                href="/servers/create"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#c98a00] px-6 text-sm text-[#f2f5fa] hover:brightness-110"
              >
                Add Server
              </Link>
            </div>
          ) : null}

          {selectedTenantId && selectedServer ? (
            <>
              <div className="mt-5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                <ToolbarChip label="SERVER ADDRESS" value={selectedServer.ipAddress} />
                <ToolbarChip label="ENTRIES" value={String(logStats.total)} />
                <ToolbarChip label="WARN / ERROR" value={`${logStats.warnCount} / ${logStats.errorCount}`} />
                <ToolbarChip label="STREAMS" value={String(logStats.streamCount)} />
              </div>

              <div className="mt-4">
                <Panel
                title="LIVE LOG STREAM"
                subtitle={
                  appliedSearch || appliedContainer
                    ? `Filtered ${logsResponse?.entries.length ?? 0} entries${appliedSearch ? ` • search: ${appliedSearch}` : ""}${appliedContainer ? ` • container: ${appliedContainer}` : ""}`
                    : `Latest ${logsResponse?.entries.length ?? 0} entries from ${selectedServer.name}`
                }
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedServer ? (
                      <Link
                        href={`/metrics?tenantId=${selectedServer.tenantId}&serverId=${selectedServer.id}`}
                        className="rounded-full border border-[#304054] bg-[#16202b] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9ec4ff] hover:border-[#456283]"
                      >
                        Metrics
                      </Link>
                    ) : null}
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                        isLoadingLogs || isRefreshFxActive
                          ? "bg-[#1e3042] text-[#b7d6ff]"
                          : "bg-[#16202b] text-[#8ea0bb]"
                      }`}
                    >
                      {isLoadingLogs || isRefreshFxActive ? "refreshing" : "idle"}
                    </span>
                  </div>
                }
              >
                <div
                  className={`relative overflow-hidden rounded-2xl border bg-[#0b1017] ${
                    isLoadingLogs || isRefreshFxActive ? "border-[#34506f]" : "border-[#202836]"
                  }`}
                >
                  {isLoadingLogs || isRefreshFxActive ? (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
                      <div className="metric-card-refresh-overlay absolute inset-0" />
                      <div className="metric-card-refresh-sheen absolute inset-y-0 left-[-38%] w-[34%] rotate-[12deg]" />
                    </div>
                  ) : null}

                  <div className="relative z-10 max-h-[720px] space-y-3 overflow-x-hidden overflow-y-auto p-4">
                    {logsResponse?.entries.length ? (
                      logsResponse.entries.map((entry, index) => (
                        <LogRow key={`${entry.timestamp}-${entry.containerId}-${index}`} entry={entry} />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#293241] bg-[#10161f] px-5 py-8 text-center">
                        <p className="text-sm text-[#8ea0bb]">No log lines returned for this server in the selected range.</p>
                        <p className="mt-2 text-xs text-[#687991]">
                          Try `24h` or `7d`, clear filters, or verify that Promtail/Loki is receiving logs from this server.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                </Panel>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
