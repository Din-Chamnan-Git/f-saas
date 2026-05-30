import { ApiError, apiGet, apiPost, apiPut } from "@/services/apiClient";
import type { SummaryCard } from "@/types/dahboard";
import type { ServerOnboardingStatus, ServerRow } from "@/types/server";

export type TenantResponse = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type ServerResponse = {
  id: string;
  tenantId: string;
  name: string;
  ipAddress: string;
  instance: string;
  environment: string;
  dockerEnabled: boolean;
  ansibleHost: string;
  ansibleUser: string;
  ansibleBecome: boolean;
  ansiblePythonInterpreter: string | null;
  billingNote: string | null;
  billingAmount: number | null;
  billingCurrency: string | null;
  billingDueDay: number | null;
};

export type ServerMetricsEndpointResponse = {
  id: string;
  serverId: string;
  endpointType: string;
  scheme: string;
  host: string;
  port: number;
  path: string;
  isEnabled: boolean;
  lastStatus: string;
  lastCheckedAt: string | null;
};

export type OnboardingJobResponse = {
  jobId: string;
  tenantId: string;
  serverId: string;
  triggeredByUserId: string;
  playbookName: string;
  runMode: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  output: string | null;
  outputRef: string | null;
  errorMessage: string | null;
};

export type WorkspaceDashboardData = {
  tenantName: string;
  tenantId: string;
  summaryCards: SummaryCard[];
  serverRows: ServerRow[];
};

export type AdminDashboardData = {
  hasTenants: boolean;
  summaryCards: Array<{
    title: string;
    value: string;
    hint: string;
  }>;
  activityItems: Array<{
    id: string;
    title: string;
    detail: string;
    timestampLabel: string;
  }>;
  platformScope: {
    name: string;
    detailLines: string[];
  };
};

export type AdminTenantDirectoryRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerLabel: string;
  ownerAssigned: boolean;
  healthLabel: string;
  healthTone: "healthy" | "attention" | "needs-owner";
  serverCount: number;
};

export type AdminTenantDirectoryData = {
  summaryCards: Array<{
    title: string;
    value: string;
    hint: string;
  }>;
  tenantRows: AdminTenantDirectoryRow[];
  currentView: {
    name: string;
    detailLines: string[];
  };
};

export type AdminServerDirectoryData = {
  summaryCards: SummaryCard[];
  serverRows: ServerRow[];
  currentView: {
    name: string;
    detailLines: string[];
  };
};

export type AdminTenantDetailData = {
  tenant: TenantResponse;
  tenantContext: {
    name: string;
    detailLines: string[];
  };
  profile: {
    name: string;
    slug: string;
    status: string;
    createdLabel: string;
  };
  summaryCards: Array<{
    title: string;
    value: string;
    hint: string;
  }>;
  ownerAssignment: {
    primaryOwner: string;
    secondaryContacts: string[];
  };
  adminNotes: string[];
};

export type CreateTenantInput = {
  name: string;
  slug: string;
};

export type CreateServerInput = {
  name: string;
  ipAddress: string;
  instance: string;
  environment: string;
  dockerEnabled: boolean;
  ansibleHost: string;
  ansibleUser: string;
  ansibleBecome: boolean;
  ansiblePythonInterpreter: string;
  billingNote?: string | null;
  billingAmount?: number | null;
  billingCurrency?: string | null;
  billingDueDay?: number | null;
};

export type UpdateServerInput = CreateServerInput;
export type UpdateServerTransferInput = UpdateServerInput & {
  tenantId?: string;
};

export type ManagedServerMetricsPorts = {
  nodeExporterPort: number;
  cadvisorPort: number;
};

export type CreateTenantOwnerInput = {
  tenantId: string;
  email: string;
  password: string;
  displayName: string;
};

export type TenantOwnerResponse = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
};

export type TenantOwnerAssignmentContactResponse = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
};

export type TenantOwnerAssignmentResponse = {
  tenantId: string;
  primaryOwnerEmail: string | null;
  primaryOwnerDisplayName: string | null;
  secondaryContacts: TenantOwnerAssignmentContactResponse[];
};

export type ServerOverviewResponse = {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  status: string;
  systemLoad1m: number;
  cpuCores: number;
  memoryTotalBytes: number;
  diskTotalBytes: number;
  uptimeSeconds: number;
};

export type MetricPointResponse = {
  timestamp: string;
  value: number;
};

export type MetricSeriesResponse = {
  metric: string;
  range: string;
  points: MetricPointResponse[];
};

export type TopContainerResponse = {
  containerName: string;
  containerId: string;
  value: number;
};

export type TopContainerMetricResponse = {
  metric: string;
  containers: TopContainerResponse[];
};

export type LogEntryResponse = {
  timestamp: string;
  containerName: string;
  containerId: string;
  logStream: string;
  message: string;
};

export type ServerLogsResponse = {
  range: string;
  limit: number;
  containerName: string | null;
  search: string | null;
  entries: LogEntryResponse[];
};

function buildAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

type ManagedServerMetricsEndpointType = "node_exporter" | "cadvisor";

type ManagedServerMetricsEndpointInput = {
  endpointType: ManagedServerMetricsEndpointType;
  scheme: "http" | "https";
  host: string;
  port: number;
  path: string;
  isEnabled: boolean;
};

function toOnboardingStatus(status?: string): ServerOnboardingStatus {
  const normalizedStatus = status?.toUpperCase();
  if (!normalizedStatus) return "running";
  if (normalizedStatus.includes("SUCCESS") || normalizedStatus === "COMPLETED") return "success";
  if (normalizedStatus.includes("FAIL") || normalizedStatus === "ERROR") return "failed";
  return "running";
}

function toEnvironment(value: string): ServerRow["environment"] {
  const normalized = value.toLowerCase();
  if (normalized === "production" || normalized === "staging") return normalized;
  return "development";
}

function toTimestamp(value?: string): number {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatRelativeTime(value: string): string {
  const differenceInMinutes = Math.max(0, Math.round((Date.now() - toTimestamp(value)) / 60000));

  if (differenceInMinutes < 1) return "just now";
  if (differenceInMinutes < 60) return `${differenceInMinutes}m ago`;

  const differenceInHours = Math.round(differenceInMinutes / 60);
  if (differenceInHours < 24) return `${differenceInHours}h ago`;

  const differenceInDays = Math.round(differenceInHours / 24);
  return `${differenceInDays}d ago`;
}

function humanizePlaybook(playbookName?: string): string {
  if (!playbookName) return "onboarding job";

  return playbookName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function buildServerRow(
  server: ServerResponse,
  onboarding: ServerOnboardingStatus,
  tenantName?: string,
): ServerRow {
  return {
    id: server.id,
    tenantId: server.tenantId,
    tenantName,
    name: server.name,
    ip: server.ipAddress,
    environment: toEnvironment(server.environment),
    onboarding,
    metrics: server.dockerEnabled ? "node exporter up" : "docker disabled",
    logs: onboarding === "failed" ? "no logs" : "recent logs",
    primaryAction: onboarding === "success" ? "Open" : "Verify",
  };
}

function deriveTenantHealth(
  tenant: TenantResponse,
  servers: ServerResponse[],
  jobs: OnboardingJobResponse[],
): Pick<AdminTenantDirectoryRow, "healthLabel" | "healthTone" | "ownerAssigned" | "ownerLabel"> {
  const normalizedStatus = tenant.status.toUpperCase();
  const hasServers = servers.length > 0;
  const latestJobs = [...jobs].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
  const latestFailedJob = latestJobs.find((job) => toOnboardingStatus(job.status) === "failed");
  const latestRunningJob = latestJobs.find((job) => toOnboardingStatus(job.status) === "running");

  if (!hasServers || normalizedStatus !== "ACTIVE") {
    return {
      ownerAssigned: false,
      ownerLabel: "unassigned",
      healthLabel: "needs owner",
      healthTone: "needs-owner",
    };
  }

  if (latestFailedJob || latestRunningJob) {
    return {
      ownerAssigned: true,
      ownerLabel: "assigned",
      healthLabel: "attention",
      healthTone: "attention",
    };
  }

  return {
    ownerAssigned: true,
    ownerLabel: "assigned",
    healthLabel: "healthy",
    healthTone: "healthy",
  };
}

async function buildTenantWorkspaceDashboardData(
  accessToken: string,
  tenantId: string,
  tenantName: string,
): Promise<WorkspaceDashboardData> {
  const servers = await apiGet<ServerResponse[]>(`/api/v1/tenants/${tenantId}/servers`, {
    headers: buildAuthHeaders(accessToken),
  });

  let jobs: OnboardingJobResponse[] = [];
  let hasOnboardingVisibility = true;
  try {
    jobs = await apiGet<OnboardingJobResponse[]>(`/api/v1/onboarding/jobs?tenantId=${tenantId}`, {
      headers: buildAuthHeaders(accessToken),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      hasOnboardingVisibility = false;
    } else {
      throw error;
    }
  }

  const latestStatusByServerId = new Map<string, ServerOnboardingStatus>();
  const sortedJobs = [...jobs].sort((a, b) => {
    const left = new Date(a.createdAt).getTime();
    const right = new Date(b.createdAt).getTime();
    return right - left;
  });

  for (const job of sortedJobs) {
    if (!latestStatusByServerId.has(job.serverId)) {
      latestStatusByServerId.set(job.serverId, toOnboardingStatus(job.status));
    }
  }

  const serverRows: ServerRow[] = servers.map((server) => {
    const onboarding = hasOnboardingVisibility ? (latestStatusByServerId.get(server.id) ?? "running") : "success";
    const row = buildServerRow(server, onboarding);

    if (!hasOnboardingVisibility) {
      row.metrics = server.dockerEnabled ? "server registered" : "docker disabled";
      row.logs = server.dockerEnabled ? "open logs page" : "docker disabled";
      row.primaryAction = "Open";
    }

    return row;
  });

  const healthyTargets = serverRows.filter((row) => row.onboarding === "success").length;
  const onboardingRunning = serverRows.filter((row) => row.onboarding === "running").length;
  const attentionNeeded = serverRows.filter((row) => row.onboarding === "failed").length;

  const byEnvironment = serverRows.reduce(
    (acc, row) => {
      acc[row.environment] += 1;
      return acc;
    },
    {
      production: 0,
      development: 0,
      staging: 0,
    },
  );

  const summaryCards: SummaryCard[] = hasOnboardingVisibility
    ? [
        {
          title: "Total Servers",
          value: String(serverRows.length),
          hint: `${byEnvironment.production} production, ${byEnvironment.development} development, ${byEnvironment.staging} staging`,
          dotColor: "bg-[#0f766e]",
        },
        {
          title: "Healthy Targets",
          value: String(healthyTargets),
          hint: "Node exporter and cadvisor are up",
          dotColor: "bg-[#0f766e]",
        },
        {
          title: "Onboarding Running",
          value: String(onboardingRunning),
          hint: "Install or verify jobs in progress",
          dotColor: "bg-[#ca8a04]",
        },
        {
          title: "Attention Needed",
          value: String(attentionNeeded),
          hint: "Latest verify-logs job failed",
          dotColor: "bg-[#dc2626]",
        },
      ]
    : [
        {
          title: "Total Servers",
          value: String(serverRows.length),
          hint: "",
          dotColor: "bg-[#0f766e]",
        },
        {
          title: "Docker Enabled",
          value: String(servers.filter((server) => server.dockerEnabled).length),
          hint: "",
          dotColor: "bg-[#1d4ed8]",
        },
        {
          title: "Registered Targets",
          value: String(serverRows.length),
          hint: "",
          dotColor: "bg-[#0f766e]",
        },
        {
          title: "Job Access",
          value: "Admin only",
          hint: "",
          dotColor: "bg-[#ca8a04]",
        },
      ];

  return {
    tenantName,
    tenantId,
    summaryCards,
    serverRows,
  };
}

export async function getWorkspaceDashboardData(accessToken: string): Promise<WorkspaceDashboardData> {
  const tenants = await listTenants(accessToken);
  const tenant = tenants[0];

  if (!tenant) {
    throw new Error("No tenant available for current user.");
  }

  return buildTenantWorkspaceDashboardData(accessToken, tenant.id, tenant.name);
}

export async function getWorkspaceDashboardDataForTenant(
  accessToken: string,
  preferredTenantId?: string,
): Promise<WorkspaceDashboardData> {
  const tenants = await listTenants(accessToken);
  const tenant = tenants.find((item) => item.id === preferredTenantId) ?? tenants[0];

  if (!tenant) {
    throw new Error("No tenant available for current user.");
  }

  return buildTenantWorkspaceDashboardData(accessToken, tenant.id, tenant.name);
}

export async function getTenantWorkspaceDashboardData(
  accessToken: string,
  tenantId: string,
  tenantName = "Current Tenant",
): Promise<WorkspaceDashboardData> {
  return buildTenantWorkspaceDashboardData(accessToken, tenantId, tenantName);
}

export async function getAdminDashboardData(accessToken: string): Promise<AdminDashboardData> {
  const tenants = await listTenants(accessToken);
  const jobsPromise = apiGet<OnboardingJobResponse[]>("/api/v1/onboarding/jobs", {
    headers: buildAuthHeaders(accessToken),
  });

  const serverGroupsPromise = Promise.all(
    tenants.map(async (tenant) => {
      const servers = await apiGet<ServerResponse[]>(`/api/v1/tenants/${tenant.id}/servers`, {
        headers: buildAuthHeaders(accessToken),
      });

      return {
        tenant,
        servers,
      };
    }),
  );

  const [jobs, serverGroups] = await Promise.all([jobsPromise, serverGroupsPromise]);

  const activeTenantCount = tenants.filter((tenant) => tenant.status.toUpperCase() === "ACTIVE").length;
  const totalServers = serverGroups.reduce((sum, item) => sum + item.servers.length, 0);
  const failedJobsCount = jobs.filter((job) => toOnboardingStatus(job.status) === "failed").length;
  const setupCount = Math.max(tenants.length - activeTenantCount, 0);
  const alertCount = failedJobsCount + setupCount;

  const serverNameById = new Map<string, string>();
  for (const group of serverGroups) {
    for (const server of group.servers) {
      serverNameById.set(server.id, server.name);
    }
  }

  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const activityItems = [...jobs]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, 3)
    .map((job) => {
      const normalizedStatus = toOnboardingStatus(job.status);
      const statusLabel =
        normalizedStatus === "failed"
          ? "failed"
          : normalizedStatus === "success"
            ? "completed"
            : "running";

      return {
        id: job.jobId,
        title: `${serverNameById.get(job.serverId) ?? "Unknown server"} ${statusLabel} ${humanizePlaybook(job.playbookName)}`,
        detail: tenantNameById.get(job.tenantId) ?? "Unknown tenant",
        timestampLabel: formatRelativeTime(job.createdAt),
      };
    });

  const fallbackActivityItems =
    tenants.length > 0
      ? tenants.slice(0, 3).map((tenant, index) => ({
          id: tenant.id,
          title: `${tenant.name} ready for platform setup`,
          detail: tenant.slug,
          timestampLabel: index === 0 ? "recent" : `${index + 1} tenants back`,
        }))
      : [];

  return {
    hasTenants: tenants.length > 0,
    summaryCards: [
      {
        title: "Tenants",
        value: String(tenants.length),
        hint: `${Math.max(tenants.length - activeTenantCount, 0)} still in setup`,
      },
      {
        title: "Owners",
        value: activeTenantCount > 0 ? String(activeTenantCount) : "--",
        hint: "Derived from active tenant coverage",
      },
      {
        title: "Servers",
        value: String(totalServers),
        hint: `${serverGroups.filter((group) => group.servers.length > 0).length} tenants with active inventory`,
      },
      {
        title: "Alerts",
        value: String(alertCount),
        hint: `${failedJobsCount} failed jobs and ${setupCount} setup gaps`,
      },
    ],
    activityItems: activityItems.length > 0 ? activityItems : fallbackActivityItems,
    platformScope: {
      name: "All tenants",
      detailLines: [`${activeTenantCount} active tenants`, `${alertCount} platform alerts`],
    },
  };
}

export async function getAdminServerDirectoryData(accessToken: string): Promise<AdminServerDirectoryData> {
  const [tenants, servers, jobs] = await Promise.all([
    listTenants(accessToken),
    listAllServers(accessToken),
    apiGet<OnboardingJobResponse[]>("/api/v1/onboarding/jobs", {
      headers: buildAuthHeaders(accessToken),
    }),
  ]);

  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const latestStatusByServerId = new Map<string, ServerOnboardingStatus>();
  for (const job of [...jobs].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))) {
    if (!latestStatusByServerId.has(job.serverId)) {
      latestStatusByServerId.set(job.serverId, toOnboardingStatus(job.status));
    }
  }

  const serverRows = servers.map((server) =>
    buildServerRow(
      server,
      latestStatusByServerId.get(server.id) ?? "running",
      tenantNameById.get(server.tenantId) ?? "Unknown tenant",
    ),
  );

  const productionCount = serverRows.filter((server) => server.environment === "production").length;
  const onboardingRunningCount = serverRows.filter((server) => server.onboarding === "running").length;
  const attentionNeededCount = serverRows.filter((server) => server.onboarding === "failed").length;
  const tenantsCoveredCount = new Set(servers.map((server) => server.tenantId)).size;

  return {
    summaryCards: [
      {
        title: "Total Servers",
        value: String(serverRows.length),
        hint: `${tenantsCoveredCount} tenants represented`,
        dotColor: "bg-[#0f766e]",
      },
      {
        title: "Production",
        value: String(productionCount),
        hint: `${Math.max(serverRows.length - productionCount, 0)} non-production`,
        dotColor: "bg-[#1d4ed8]",
      },
      {
        title: "Onboarding Running",
        value: String(onboardingRunningCount),
        hint: "Cross-tenant jobs still in progress",
        dotColor: "bg-[#ca8a04]",
      },
      {
        title: "Attention Needed",
        value: String(attentionNeededCount),
        hint: "Latest onboarding status failed",
        dotColor: "bg-[#dc2626]",
      },
    ],
    serverRows,
    currentView: {
      name: "All tenants",
      detailLines: [`${tenantsCoveredCount} tenants represented`, `${serverRows.length} servers total`],
    },
  };
}

export async function getAdminTenantDirectoryData(accessToken: string): Promise<AdminTenantDirectoryData> {
  const tenants = await listTenants(accessToken);
  const jobs = tenants.length
    ? await apiGet<OnboardingJobResponse[]>("/api/v1/onboarding/jobs", {
        headers: buildAuthHeaders(accessToken),
      })
    : [];

  const serverGroups = await Promise.all(
    tenants.map(async (tenant) => {
      const servers = await apiGet<ServerResponse[]>(`/api/v1/tenants/${tenant.id}/servers`, {
        headers: buildAuthHeaders(accessToken),
      });

      const tenantJobs = jobs.filter((job) => job.tenantId === tenant.id);
      const derived = deriveTenantHealth(tenant, servers, tenantJobs);

      return {
        tenant,
        servers,
        tenantJobs,
        row: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
              status: tenant.status,
          ownerLabel: derived.ownerLabel,
          ownerAssigned: derived.ownerAssigned,
          healthLabel: derived.healthLabel,
          healthTone: derived.healthTone,
          serverCount: servers.length,
        },
      };
    }),
  );

  const activeTenantCount = tenants.filter((tenant) => tenant.status.toUpperCase() === "ACTIVE").length;
  const ownerAssignedCount = serverGroups.filter((group) => group.row.ownerAssigned).length;
  const healthyWorkspaceCount = serverGroups.filter((group) => group.row.healthTone === "healthy").length;
  const needsSetupCount = serverGroups.filter((group) => group.row.healthTone === "needs-owner").length;

  return {
    summaryCards: [
      {
        title: "Active Tenants",
        value: String(activeTenantCount),
        hint: `${Math.max(tenants.length - activeTenantCount, 0)} still in setup`,
      },
      {
        title: "Owners Assigned",
        value: String(ownerAssignedCount),
        hint: `${Math.max(tenants.length - ownerAssignedCount, 0)} tenants missing primary owner`,
      },
      {
        title: "Healthy Workspaces",
        value: String(healthyWorkspaceCount),
        hint: `${Math.max(tenants.length - healthyWorkspaceCount, 0)} with attention required`,
      },
      {
        title: "Needs Setup",
        value: String(needsSetupCount),
        hint: "Tenants without owner or inventory",
      },
    ],
    tenantRows: serverGroups.map((group) => group.row),
    currentView: {
      name: "Admin listing",
      detailLines: [`${tenants.length} tenants total`, `${Math.max(tenants.length - ownerAssignedCount, 0)} need owner assignment`],
    },
  };
}

export async function getAdminTenantDetailData(
  accessToken: string,
  tenantId: string,
): Promise<AdminTenantDetailData> {
  const tenant = await apiGet<TenantResponse>(`/api/v1/tenants/${tenantId}`, {
    headers: buildAuthHeaders(accessToken),
  });
  const servers = await apiGet<ServerResponse[]>(`/api/v1/tenants/${tenantId}/servers`, {
    headers: buildAuthHeaders(accessToken),
  });
  const ownerAssignment = await apiGet<TenantOwnerAssignmentResponse>(`/api/v1/tenant-owners/tenants/${tenantId}`, {
    headers: buildAuthHeaders(accessToken),
  });
  const jobs = await apiGet<OnboardingJobResponse[]>(`/api/v1/onboarding/jobs?tenantId=${tenantId}`, {
    headers: buildAuthHeaders(accessToken),
  });

  const byEnvironment = servers.reduce(
    (acc, server) => {
      const environment = toEnvironment(server.environment);
      acc[environment] += 1;
      return acc;
    },
    {
      production: 0,
      development: 0,
      staging: 0,
    },
  );

  const latestStatusByServerId = new Map<string, ServerOnboardingStatus>();
  for (const job of [...jobs].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))) {
    if (!latestStatusByServerId.has(job.serverId)) {
      latestStatusByServerId.set(job.serverId, toOnboardingStatus(job.status));
    }
  }

  const runningJobsCount = jobs.filter((job) => toOnboardingStatus(job.status) === "running").length;
  const healthyServerCount = servers.filter((server) => (latestStatusByServerId.get(server.id) ?? "running") === "success").length;
  const logsCoverageCount = servers.filter((server) => (latestStatusByServerId.get(server.id) ?? "running") !== "failed").length;
  const primaryOwner = ownerAssignment.primaryOwnerEmail
    ? ownerAssignment.primaryOwnerDisplayName
      ? `${ownerAssignment.primaryOwnerDisplayName} <${ownerAssignment.primaryOwnerEmail}>`
      : ownerAssignment.primaryOwnerEmail
    : "unassigned";
  const secondaryContacts = ownerAssignment.secondaryContacts.map((contact) =>
    contact.displayName ? `${contact.displayName} <${contact.email}>` : contact.email,
  );
  const notes: string[] = [];

  const failedJob = jobs.find((job) => toOnboardingStatus(job.status) === "failed");
  const runningJob = jobs.find((job) => toOnboardingStatus(job.status) === "running");

  if (logsCoverageCount < servers.length) {
    const affectedServer = servers.find((server) => (latestStatusByServerId.get(server.id) ?? "running") === "failed");
    notes.push(`Logs agent missing on ${affectedServer?.name.toLowerCase() ?? "one server"}`);
  }

  if (primaryOwner === "unassigned") {
    notes.push("Invite primary owner before go-live");
  } else {
    notes.push("Invite backup owner before go-live");
  }

  if (failedJob) {
    notes.push(`Review failed ${humanizePlaybook(failedJob.playbookName)} job from recent history`);
  } else if (runningJob) {
    notes.push(`Track running ${humanizePlaybook(runningJob.playbookName)} job before handoff`);
  }

  while (notes.length < 3) {
    notes.push("Review tenant setup checklist before handoff");
  }

  return {
    tenant,
    tenantContext: {
      name: tenant.name,
      detailLines: [
        primaryOwner === "unassigned" ? "Owner assignment pending" : "Primary owner assigned",
        `${servers.length} servers under management`,
      ],
    },
    profile: {
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status.toLowerCase(),
      createdLabel: "Created date not exposed by current API",
    },
    summaryCards: [
      {
        title: "Servers",
        value: String(servers.length),
        hint: `${byEnvironment.production} production, ${byEnvironment.development} dev, ${byEnvironment.staging} staging`,
      },
      {
        title: "Jobs Running",
        value: String(runningJobsCount),
        hint: "Onboarding and verify tasks",
      },
      {
        title: "Metrics State",
        value: `${healthyServerCount}/${Math.max(servers.length, 1)}`,
        hint: "Healthy scrape targets",
      },
      {
        title: "Logs Coverage",
        value: `${logsCoverageCount}/${Math.max(servers.length, 1)}`,
        hint: logsCoverageCount < servers.length ? "Some nodes need promtail" : "Logs coverage across tenant",
      },
    ],
    ownerAssignment: {
      primaryOwner,
      secondaryContacts,
    },
    adminNotes: notes.slice(0, 3),
  };
}

export async function listTenants(accessToken: string): Promise<TenantResponse[]> {
  return apiGet<TenantResponse[]>("/api/v1/tenants", {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function listAllServers(accessToken: string): Promise<ServerResponse[]> {
  return apiGet<ServerResponse[]>("/api/v1/servers", {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function createTenant(accessToken: string, payload: CreateTenantInput): Promise<TenantResponse> {
  return apiPost<TenantResponse, CreateTenantInput>("/api/v1/tenants", payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function updateTenant(
  accessToken: string,
  tenantId: string,
  payload: { name: string; slug: string; status: string },
): Promise<TenantResponse> {
  return apiPut<TenantResponse, { name: string; slug: string; status: string }>(`/api/v1/tenants/${tenantId}`, payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function createServer(
  accessToken: string,
  tenantId: string,
  payload: CreateServerInput,
): Promise<ServerResponse> {
  return apiPost<ServerResponse, CreateServerInput>(`/api/v1/tenants/${tenantId}/servers`, payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getServer(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<ServerResponse> {
  return apiGet<ServerResponse>(`/api/v1/tenants/${tenantId}/servers/${serverId}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function updateServer(
  accessToken: string,
  tenantId: string,
  serverId: string,
  payload: UpdateServerTransferInput,
): Promise<ServerResponse> {
  return apiPut<ServerResponse, UpdateServerTransferInput>(`/api/v1/tenants/${tenantId}/servers/${serverId}`, payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function listServerMetricsEndpoints(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<ServerMetricsEndpointResponse[]> {
  return apiGet<ServerMetricsEndpointResponse[]>(
    `/api/v1/tenants/${tenantId}/servers/${serverId}/metrics-endpoints`,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

async function saveServerMetricsEndpoint(
  accessToken: string,
  tenantId: string,
  serverId: string,
  endpointId: string | null,
  payload: ManagedServerMetricsEndpointInput,
): Promise<ServerMetricsEndpointResponse> {
  if (endpointId) {
    return apiPut<ServerMetricsEndpointResponse, ManagedServerMetricsEndpointInput>(
      `/api/v1/tenants/${tenantId}/servers/${serverId}/metrics-endpoints/${endpointId}`,
      payload,
      {
        headers: buildAuthHeaders(accessToken),
      },
    );
  }

  return apiPost<ServerMetricsEndpointResponse, ManagedServerMetricsEndpointInput>(
    `/api/v1/tenants/${tenantId}/servers/${serverId}/metrics-endpoints`,
    payload,
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function checkAllServerMetricsEndpoints(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<ServerMetricsEndpointResponse[]> {
  return apiPost<ServerMetricsEndpointResponse[], Record<string, never>>(
    `/api/v1/tenants/${tenantId}/servers/${serverId}/metrics-endpoints/check-all`,
    {},
    {
      headers: buildAuthHeaders(accessToken),
    },
  );
}

export async function saveManagedServerMetricsEndpoints(
  accessToken: string,
  tenantId: string,
  server: Pick<ServerResponse, "id" | "ipAddress" | "dockerEnabled">,
  ports: ManagedServerMetricsPorts,
): Promise<ServerMetricsEndpointResponse[]> {
  const endpoints = await listServerMetricsEndpoints(accessToken, tenantId, server.id).catch(() => []);
  const endpointByType = new Map(endpoints.map((endpoint) => [endpoint.endpointType, endpoint]));

  const nodeExporterEndpoint = await saveServerMetricsEndpoint(accessToken, tenantId, server.id, endpointByType.get("node_exporter")?.id ?? null, {
    endpointType: "node_exporter",
    scheme: "http",
    host: server.ipAddress,
    port: ports.nodeExporterPort,
    path: "/metrics",
    isEnabled: true,
  });

  const cadvisorEndpoint = await saveServerMetricsEndpoint(accessToken, tenantId, server.id, endpointByType.get("cadvisor")?.id ?? null, {
    endpointType: "cadvisor",
    scheme: "http",
    host: server.ipAddress,
    port: ports.cadvisorPort,
    path: "/metrics",
    isEnabled: server.dockerEnabled,
  });

  return [nodeExporterEndpoint, cadvisorEndpoint];
}

export async function createTenantOwner(
  accessToken: string,
  payload: CreateTenantOwnerInput,
): Promise<TenantOwnerResponse> {
  return apiPost<TenantOwnerResponse, CreateTenantOwnerInput>("/api/v1/tenant-owners", payload, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function listTenantServers(accessToken: string, tenantId: string): Promise<ServerResponse[]> {
  return apiGet<ServerResponse[]>(`/api/v1/tenants/${tenantId}/servers`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getServerOverview(
  accessToken: string,
  tenantId: string,
  serverId: string,
): Promise<ServerOverviewResponse> {
  return apiGet<ServerOverviewResponse>(`/api/v1/tenants/${tenantId}/servers/${serverId}/overview`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getServerMetricSeries(
  accessToken: string,
  tenantId: string,
  serverId: string,
  metric: "cpu" | "memory" | "disk" | "network",
  range: string,
): Promise<MetricSeriesResponse> {
  return apiGet<MetricSeriesResponse>(`/api/v1/tenants/${tenantId}/servers/${serverId}/charts/${metric}?range=${range}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getTopContainers(
  accessToken: string,
  tenantId: string,
  serverId: string,
  metric: "cpu" | "memory",
): Promise<TopContainerMetricResponse> {
  return apiGet<TopContainerMetricResponse>(`/api/v1/tenants/${tenantId}/servers/${serverId}/containers/top/${metric}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getServerLogs(
  accessToken: string,
  tenantId: string,
  serverId: string,
  filters?: {
    range?: string;
    limit?: number;
    containerName?: string;
    search?: string;
  },
): Promise<ServerLogsResponse> {
  const searchParams = new URLSearchParams();
  if (filters?.range) {
    searchParams.set("range", filters.range);
  }
  if (typeof filters?.limit === "number") {
    searchParams.set("limit", String(filters.limit));
  }
  if (filters?.containerName?.trim()) {
    searchParams.set("containerName", filters.containerName.trim());
  }
  if (filters?.search?.trim()) {
    searchParams.set("search", filters.search.trim());
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiGet<ServerLogsResponse>(`/api/v1/tenants/${tenantId}/servers/${serverId}/logs${suffix}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function listOnboardingJobs(
  accessToken: string,
  filters?: {
    tenantId?: string;
    serverId?: string;
  },
): Promise<OnboardingJobResponse[]> {
  const searchParams = new URLSearchParams();
  if (filters?.tenantId) {
    searchParams.set("tenantId", filters.tenantId);
  }
  if (filters?.serverId) {
    searchParams.set("serverId", filters.serverId);
  }

  const query = searchParams.toString();
  return apiGet<OnboardingJobResponse[]>(`/api/v1/onboarding/jobs${query ? `?${query}` : ""}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function startOnboardingJob(
  accessToken: string,
  payload: {
    tenantId: string;
    serverId: string;
    playbookName: string;
    inventoryHost?: string;
  },
): Promise<OnboardingJobResponse> {
  return apiPost<
    OnboardingJobResponse,
    {
      tenantId: string;
      serverId: string;
      playbookName: string;
      inventoryHost?: string;
    }
  >("/api/v1/onboarding/jobs", payload, {
    headers: buildAuthHeaders(accessToken),
  });
}
