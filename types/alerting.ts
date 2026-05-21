export type TenantNotificationSettings = {
  tenantId: string;
  telegramEnabled: boolean;
  telegramBotTokenConfigured: boolean;
  telegramChatId: string | null;
  sendResolved: boolean;
  alertPrefix: string | null;
  updatedAt: string | null;
};

export type UpsertTenantNotificationSettingsInput = {
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  sendResolved: boolean;
  alertPrefix: string | null;
};

export type AlertSilence = {
  id: string;
  scope: "tenant" | "server";
  tenantId: string;
  serverId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  activeNow: boolean;
};

export type UpsertAlertSilenceInput = {
  serverId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  enabled: boolean;
};

export type AlertPolicy = {
  scope: "global" | "tenant" | "server";
  tenantId: string | null;
  serverId: string | null;
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  diskFreePercent: number | null;
  serverDownForMinutes: number | null;
  containerDownForMinutes: number | null;
  containerRestartCount: number | null;
  customMetricName: string | null;
  customPromqlQuery: string | null;
  customComparison: ">" | ">=" | "<" | "<=" | null;
  customThreshold: number | null;
  enabled: boolean;
  updatedAt: string | null;
};

export type UpsertAlertPolicyInput = {
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  diskFreePercent: number | null;
  serverDownForMinutes: number | null;
  containerDownForMinutes: number | null;
  containerRestartCount: number | null;
  customMetricName: string | null;
  customPromqlQuery: string | null;
  customComparison: ">" | ">=" | "<" | "<=" | null;
  customThreshold: number | null;
  enabled: boolean;
};

export type EffectiveAlertPolicy = {
  tenantId: string;
  serverId: string;
  cpuUsagePercent: number;
  cpuUsageSource: "server" | "tenant" | "global" | "default";
  memoryUsagePercent: number;
  memoryUsageSource: "server" | "tenant" | "global" | "default";
  diskFreePercent: number;
  diskFreeSource: "server" | "tenant" | "global" | "default";
  serverDownForMinutes: number;
  serverDownSource: "server" | "tenant" | "global" | "default";
  containerDownForMinutes: number;
  containerDownSource: "server" | "tenant" | "global" | "default";
  containerRestartCount: number;
  containerRestartSource: "server" | "tenant" | "global" | "default";
  customMetricName: string | null;
  customPromqlQuery: string | null;
  customComparison: ">" | ">=" | "<" | "<=" | null;
  customThreshold: number | null;
  customMetricSource: "server" | "tenant" | "global" | "default";
  enabled: boolean;
  enabledSource: "server" | "tenant" | "global" | "default";
};
