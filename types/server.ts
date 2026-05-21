export type ServerEnvironment = "development" | "production" | "staging";
export type ServerOnboardingStatus = "success" | "running" | "failed";
export type ServerAction = "Open" | "Verify";

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
