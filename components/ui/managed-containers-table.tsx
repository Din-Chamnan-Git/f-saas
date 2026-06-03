import type { ManagedContainerResponse } from "@/services/workspaceService";

type ManagedContainersTableProps = {
  rows: ManagedContainerResponse[];
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "up") {
    return "border-[#244530] bg-[#17261d] text-[#bff2c7]";
  }

  if (normalized === "down") {
    return "border-[#7f2e2e] bg-[#311f22] text-[#ffb7b7]";
  }

  return "border-[#324055] bg-[#171d27] text-[#8c9eba]";
}

function getStatusLabel(status: string) {
  return status.toUpperCase();
}

function statusRank(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "down") return 0;
  if (normalized === "unknown") return 1;
  return 2;
}

export default function ManagedContainersTable({ rows }: ManagedContainersTableProps) {
  const orderedRows = [...rows].sort(
    (left, right) =>
      statusRank(left.status) - statusRank(right.status) ||
      left.containerName.localeCompare(right.containerName, undefined, { sensitivity: "base" }),
  );

  const upCount = orderedRows.filter((row) => row.status === "up").length;
  const downCount = orderedRows.filter((row) => row.status === "down").length;
  const unknownCount = orderedRows.filter((row) => row.status === "unknown").length;

  return (
    <section className="app-card mt-8 rounded-[18px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Managed Containers</h2>
          <p className="app-text-soft mt-2 text-[14px] leading-[20px]">Live container status from cAdvisor.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
            {upCount} up
          </span>
          <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
            {downCount} down
          </span>
          <span className="rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
            {unknownCount} unknown
          </span>
        </div>
      </div>

      {!orderedRows.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#2d3949] bg-[#121922] px-5 py-6">
          <p className="text-sm text-[#8c9eba]">No managed containers are available for this server.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="hidden rounded-xl border border-[#273244] bg-[#141a24] px-4 py-3 text-xs text-[#8c9eba] md:grid md:grid-cols-[0.55fr_1.6fr_1.05fr]">
            <span>Container</span>
            <span>Status</span>
            <span>Last seen</span>
          </div>

          {orderedRows.map((row) => {
            const statusTone = getStatusTone(row.status);

            return (
              <article
                key={row.id}
                className="rounded-2xl border border-[#273244] bg-[#121922] px-4 py-4 shadow-[0_16px_40px_rgba(2,7,16,0.18)]"
              >
                <div className="grid gap-4 md:grid-cols-[0.55fr_1.6fr_1.05fr] md:items-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Container</p>
                    <p className="mt-1 text-[15px] font-semibold text-[#f2f5fa]">{row.containerName}</p>
                    <p className="mt-1 font-mono text-xs text-[#8c9eba]">{row.containerIdentifier}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${statusTone}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97] md:hidden">Last seen</p>
                    <p className="mt-1 text-sm text-[#dce4f0]">{formatTimestamp(row.lastSeenAt)}</p>
                    <p className="mt-1 text-xs text-[#8c9eba]">{row.statusMessage ?? "No status message"}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
