export type ServerEnvironment = "development" | "production" | "staging";
export type ServerOnboardingStatus = "success" | "running" | "failed";
export type ServerAction = "Open" | "Verify";
export type ServerUsageMetric = "cpu" | "memory" | "disk";

export type ServerRow = {
  id?: string;
  tenantId?: string;
  tenantName?: string;
  name: string;
  ip: string;
  environment: ServerEnvironment;
  onboarding: ServerOnboardingStatus;
  metrics: string;
  logs: string;
  primaryAction: ServerAction;
};

export type AdminFleetServerRow = {
  rank: number;
  serverId: string;
  tenantId: string;
  tenantName: string;
  serverName: string;
  ipAddress: string;
  environment: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  utilizationScore: number;
  worstMetric: ServerUsageMetric;
  status: string;
};
