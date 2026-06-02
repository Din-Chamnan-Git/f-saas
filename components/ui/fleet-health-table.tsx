import type { AdminFleetServerRow, ServerUsageMetric } from "@/types/server";

type FleetHealthTableProps = {
  rows: AdminFleetServerRow[];
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getUsageTone(value: number) {
  if (value >= 85) {
    return {
      border: "border-[#7f2e2e]",
      bg: "bg-[#311f22]",
      text: "text-[#ffb7b7]",
      badge: "bg-[#4a2525] text-[#ffb7b7]",
    };
  }

  if (value >= 65) {
    return {
      border: "border-[#6b5322]",
      bg: "bg-[#2d2417]",
      text: "text-[#ffd79b]",
      badge: "bg-[#4a3922] text-[#f9d9a7]",
    };
  }

  return {
    border: "border-[#244530]",
    bg: "bg-[#17261d]",
    text: "text-[#bff2c7]",
    badge: "bg-[#244530] text-[#bff2c7]",
  };
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "up") {
    return "border-[#244530] bg-[#17261d] text-[#bff2c7]";
  }

  if (normalized === "degraded") {
    return "border-[#6b5322] bg-[#2d2417] text-[#f9d9a7]";
  }

  if (normalized === "down") {
    return "border-[#7f2e2e] bg-[#311f22] text-[#ffb7b7]";
  }

  return "border-[#324055] bg-[#171d27] text-[#8c9eba]";
}

function getWorstMetricLabel(metric: ServerUsageMetric) {
  return metric === "cpu" ? "CPU" : metric === "memory" ? "RAM" : "Disk";
}

export default function FleetHealthTable({ rows }: FleetHealthTableProps) {
  const orderedRows = [...rows].sort(
    (left, right) => right.utilizationScore - left.utilizationScore || left.rank - right.rank,
  );

  if (!orderedRows.length) {
    return (
      <section className="app-card mt-8 rounded-[18px] p-6">
        <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Fleet Health</h2>
        <p className="app-text-soft mt-2 text-[14px] leading-[20px]">No server metrics are available yet.</p>
      </section>
    );
  }

  const topServer = orderedRows[0];
  const topTone = getUsageTone(topServer.utilizationScore);
  const criticalCount = orderedRows.filter((row) => row.utilizationScore >= 85).length;
  const elevatedCount = orderedRows.filter((row) => row.utilizationScore >= 65).length;

  return (
    <section className="app-card mt-8 rounded-[18px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold text-[var(--app-text)]">Fleet Health</h2>
          <p className="app-text-soft mt-2 text-[14px] leading-[20px]">
            Every server across all tenants, sorted by the highest current CPU, RAM, or Disk usage.
          </p>
        </div>

        <div className="rounded-2xl border border-[#314153] bg-[#141b24] px-4 py-3">
          <p className="text-[10px] tracking-[0.18em] text-[#6f819c]">HIGHEST RIGHT NOW</p>
          <p className="mt-2 text-lg text-[var(--app-text)]">{topServer.serverName}</p>
          <p className="mt-1 text-sm text-[#8c9eba]">
            {topServer.tenantName} • {formatPercent(topServer.utilizationScore)} peak on {getWorstMetricLabel(topServer.worstMetric)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${topTone.badge}`}>
              Rank #{topServer.rank}
            </span>
            <span className="inline-flex rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
              {criticalCount} critical
            </span>
            <span className="inline-flex rounded-full border border-[#314153] bg-[#111721] px-3 py-1 text-xs text-[#9ec4ff]">
              {elevatedCount} elevated
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="hidden rounded-xl border border-[#273244] bg-[#141a24] px-4 py-3 text-xs text-[#8c9eba] md:grid md:grid-cols-[0.45fr_1.75fr_1.15fr_0.75fr_0.75fr_0.75fr_1fr]">
          <span>Rank</span>
          <span>Server</span>
          <span>Tenant</span>
          <span>CPU</span>
          <span>RAM</span>
          <span>Disk</span>
          <span>Utilization</span>
        </div>

        {orderedRows.map((row) => {
          const tone = getUsageTone(row.utilizationScore);
          const statusTone = getStatusTone(row.status);
          const isTop = row.rank === 1;

          return (
            <article
              key={row.serverId}
              className={`rounded-2xl border px-4 py-4 shadow-[0_16px_40px_rgba(2,7,16,0.18)] ${
                isTop
                  ? "border-[#6b5322] bg-[linear-gradient(180deg,#20180f_0%,#121923_100%)]"
                  : "border-[#273244] bg-[#121922]"
              }`}
            >
              <div className="grid gap-4 md:grid-cols-[0.45fr_1.75fr_1.15fr_0.75fr_0.75fr_0.75fr_1fr] md:items-center">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold ${
                      isTop ? "border-[#ffb84d] bg-[#2d2417] text-[#ffd79b]" : "border-[#314153] bg-[#141b24] text-[#9ec4ff]"
                    }`}
                  >
                    #{row.rank}
                  </span>
                  <div className="md:hidden">
                    <p className="text-[10px] tracking-[0.18em] text-[#6f819c]">SERVER</p>
                    <p className="mt-1 text-[15px] text-[var(--app-text)]">{row.serverName}</p>
                  </div>
                </div>

                <div>
                  <div className="hidden md:block">
                    <p className="text-[15px] text-[var(--app-text)]">{row.serverName}</p>
                    <p className="mt-1 text-sm text-[#8c9eba]">{row.ipAddress}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 md:mt-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${statusTone}`}>{row.status}</span>
                    {isTop ? (
                      <span className="inline-flex rounded-full border border-[#6b5322] bg-[#2d2417] px-2.5 py-1 text-[11px] text-[#ffd79b]">
                        Highest right now
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[#8c9eba] md:hidden">{row.ipAddress}</p>
                </div>

                <div className="md:block">
                  <p className="text-[10px] tracking-[0.18em] text-[#6f819c] md:hidden">TENANT</p>
                  <p className="text-sm text-[var(--app-text)]">{row.tenantName}</p>
                </div>

                <div className="md:text-left">
                  <p className="text-[10px] tracking-[0.18em] text-[#6f819c] md:hidden">CPU</p>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${getUsageTone(row.cpuUsagePercent).badge}`}>
                    {formatPercent(row.cpuUsagePercent)}
                  </span>
                </div>

                <div className="md:text-left">
                  <p className="text-[10px] tracking-[0.18em] text-[#6f819c] md:hidden">RAM</p>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${getUsageTone(row.memoryUsagePercent).badge}`}>
                    {formatPercent(row.memoryUsagePercent)}
                  </span>
                </div>

                <div className="md:text-left">
                  <p className="text-[10px] tracking-[0.18em] text-[#6f819c] md:hidden">DISK</p>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${getUsageTone(row.diskUsagePercent).badge}`}>
                    {formatPercent(row.diskUsagePercent)}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] tracking-[0.18em] text-[#6f819c] md:hidden">UTILIZATION</p>
                  <div className={`rounded-2xl border px-3 py-3 ${tone.border} ${tone.bg}`}>
                    <p className={`text-[18px] font-semibold leading-none ${tone.text}`}>{formatPercent(row.utilizationScore)}</p>
                    <p className="mt-1 text-xs text-[#8c9eba]">Peak {getWorstMetricLabel(row.worstMetric)}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
