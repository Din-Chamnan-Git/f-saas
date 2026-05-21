import type { SummaryCard } from "@/types/dahboard";
import type { ServerRow } from "@/types/server";

export type WorkspaceViewModel = {
  tenantName: string;
  tenantId: string;
  summaryCards: SummaryCard[];
  serverRows: ServerRow[];
};
