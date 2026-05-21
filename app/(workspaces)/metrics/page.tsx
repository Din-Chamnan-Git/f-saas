"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  getServerMetricSeries,
  getServerOverview,
  getTopContainers,
  listTenantServers,
  listTenants,
  type MetricSeriesResponse,
  type ServerOverviewResponse,
  type ServerResponse,
  type TenantResponse,
  type TopContainerMetricResponse,
} from "@/services/workspaceService";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const RANGE_OPTIONS = ["1h", "6h", "24h"] as const;
const METRICS_PREFERENCES_STORAGE_KEY = "metricsDashboardPreferences";
const REFRESH_OPTIONS = [
  { value: "manual", label: "Manual", intervalMs: null },
  { value: "30s", label: "30s", intervalMs: 30_000 },
  { value: "1m", label: "1m", intervalMs: 60_000 },
  { value: "5m", label: "5m", intervalMs: 300_000 },
] as const;

type MetricKey = "cpu" | "memory" | "disk" | "network";
type MetricSeriesMap = Record<MetricKey, MetricSeriesResponse | null>;
type RefreshOption = (typeof REFRESH_OPTIONS)[number];
type ToolbarControl = "tenant" | "server" | "range" | "refresh";
type ToolbarOption = {
  value: string;
  label: string;
  description?: string;
};
type MetricsPreferences = {
  selectedTenantId?: string;
  selectedServerIdByTenant?: Record<string, string>;
  selectedRange?: (typeof RANGE_OPTIONS)[number];
  selectedRefresh?: RefreshOption["value"];
};

const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
  Metrics: "/metrics",
};

const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
  Metrics: "/metrics",
};

function readMetricsPreferences(): MetricsPreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(METRICS_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as MetricsPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMetricsPreferences(update: (current: MetricsPreferences) => MetricsPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const nextValue = update(readMetricsPreferences());
  window.localStorage.setItem(METRICS_PREFERENCES_STORAGE_KEY, JSON.stringify(nextValue));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatLoad(value: number) {
  return value > 0 ? value.toFixed(2) : "0.00";
}

function formatInteger(value: number) {
  return Number.isFinite(value) ? Math.round(value).toString() : "--";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "--";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  // Use less precision for larger units so values look closer to common CLI output.
  const digits = unitIndex >= 3 ? 1 : currentValue >= 100 ? 0 : currentValue >= 10 ? 1 : 2;
  return `${currentValue.toFixed(digits)} ${units[unitIndex]}`;
}

function formatDurationFromSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "--";
  }

  const totalSeconds = Math.floor(value);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);

  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays > 0) {
      return hours > 0 ? `${weeks}w ${remainingDays}d ${hours}h` : `${weeks}w ${remainingDays}d`;
    }
    return hours > 0 ? `${weeks}w ${hours}h` : `${weeks}w`;
  }

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return minutes > 0 ? `${minutes}m` : `${totalSeconds}s`;
}

function formatChartValue(metric: MetricKey, value: number) {
  if (metric === "network") {
    return formatBytesPerSecond(value);
  }

  return `${value.toFixed(1)}%`;
}

function formatBytesPerSecond(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.00 b/s";

  const units = ["b/s", "kb/s", "Mb/s", "Gb/s"];
  let v = value;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v = v / 1000;
    i += 1;
  }

  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

function getChartSeverity(metric: MetricKey, value: number) {
  if (!Number.isFinite(value)) {
    return { label: "UNKNOWN", className: "border-[#3a4658] text-[#8c9eba]", hint: "No usable data" };
  }

  if (metric === "network") {
    // thresholds are in bytes per second
    const KB = 1000;
    const MB = 1000 * KB;
    if (value >= 2 * MB) {
      return { label: "HIGH", className: "border-[#5a2727] text-[#ff9b9b]", hint: "HIGH >= 2 Mb/s" };
    }
    if (value >= 500 * KB) {
      return { label: "MEDIUM", className: "border-[#5a4a23] text-[#ffd58a]", hint: "MEDIUM 500 kb/s to < 2 Mb/s" };
    }
    return { label: "LOW", className: "border-[#214d3a] text-[#89d6ab]", hint: "LOW < 500 kb/s" };
  }

  if (value >= 75) {
    return { label: "HIGH", className: "border-[#5a2727] text-[#ff9b9b]", hint: "HIGH >= 75%" };
  }
  if (value >= 25) {
    return { label: "MEDIUM", className: "border-[#5a4a23] text-[#ffd58a]", hint: "MEDIUM 25% to < 75%" };
  }
  return { label: "LOW", className: "border-[#214d3a] text-[#89d6ab]", hint: "LOW < 25%" };
}

function formatTopContainerValue(metric: "cpu" | "memory", value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (metric === "memory") {
    return formatBytes(value);
  }

  // Some data sources report CPU in nanocores; normalize large values to percent.
  const normalizedCpuPercent = normalizeTopCpuPercent(value);
  return `${normalizedCpuPercent.toFixed(1)}%`;
}

function normalizeTopCpuPercent(value: number) {
  return value > 1_000 ? value / 10_000_000 : value;
}

function getTopContainerLevel(metric: "cpu" | "memory", value: number, memoryTotalBytes?: number | null) {
  if (!Number.isFinite(value)) {
    return { label: "UNKNOWN", className: "border-[#3a4658] text-[#8c9eba]" };
  }

  if (metric === "cpu") {
    const cpuPercent = normalizeTopCpuPercent(value);
    if (cpuPercent >= 80) {
      return { label: "HIGH", className: "border-[#5a2727] text-[#ff9b9b]" };
    }
    if (cpuPercent >= 40) {
      return { label: "MEDIUM", className: "border-[#5a4a23] text-[#ffd58a]" };
    }
    return { label: "LOW", className: "border-[#214d3a] text-[#89d6ab]" };
  }

  if (Number.isFinite(memoryTotalBytes) && (memoryTotalBytes ?? 0) > 0) {
    const usagePercent = (value / (memoryTotalBytes ?? 1)) * 100;
    if (usagePercent >= 40) {
      return { label: "HIGH", className: "border-[#5a2727] text-[#ff9b9b]" };
    }
    if (usagePercent >= 20) {
      return { label: "MEDIUM", className: "border-[#5a4a23] text-[#ffd58a]" };
    }
    return { label: "LOW", className: "border-[#214d3a] text-[#89d6ab]" };
  }

  if (value >= 2 * 1024 * 1024 * 1024) {
    return { label: "HIGH", className: "border-[#5a2727] text-[#ff9b9b]" };
  }
  if (value >= 512 * 1024 * 1024) {
    return { label: "MEDIUM", className: "border-[#5a4a23] text-[#ffd58a]" };
  }
  return { label: "LOW", className: "border-[#214d3a] text-[#89d6ab]" };
}

function getLatestPoint(series: MetricSeriesResponse | null) {
  return series?.points.at(-1) ?? null;
}

function formatPointTime(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatAxisValue(metric: MetricKey, value: number) {
  if (metric === "network") {
    // Use SI units, 1000 base, and match formatBytesPerSecond for axis labels
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Gb/s`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mb/s`;
    if (abs >= 1000) return `${Math.round(value / 1000)} kb/s`;
    return `${value.toFixed(1)} b/s`;
  }

  return `${value.toFixed(0)}%`;
}

function getMetricPalette(metric: MetricKey) {
  if (metric === "cpu") {
    return {
      line: "#ffcf4d",
      fill: "rgba(255, 207, 77, 0.16)",
      legend: "CPU usage",
    };
  }

  if (metric === "memory") {
    return {
      line: "#57a6ff",
      fill: "rgba(87, 166, 255, 0.16)",
      legend: "Memory usage",
    };
  }

  if (metric === "disk") {
    return {
      line: "#6fd46a",
      fill: "rgba(111, 212, 106, 0.16)",
      legend: "Disk usage",
    };
  }

  return {
    line: "#8fb7ff",
    fill: "rgba(92, 155, 255, 0.2)",
    legend: "Network rate",
  };
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
      <div className="flex items-start justify-between gap-4 border-b border-[#222b38] px-5 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-[#6e7f97]">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-[#8ea0bb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function GaugePanel({
  title,
  value,
  hint,
  percent,
  strokeColor,
  isRefreshing,
}: {
  title: string;
  value: string;
  hint: string;
  percent: number;
  strokeColor: string;
  isRefreshing: boolean;
}) {
  const clampedPercent = Math.max(0, Math.min(percent, 100));

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,#191f28_0%,#12171f_100%)] p-5 transition-[border-color,box-shadow] duration-300 ${
        isRefreshing
          ? "border-[#34506f] shadow-[0_0_0_1px_rgba(87,166,255,0.08),0_18px_40px_rgba(4,8,16,0.24)]"
          : "border-[#27303d]"
      }`}
    >
      {isRefreshing ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
          <div className="metric-card-refresh-overlay absolute inset-0" />
          <div className="metric-card-refresh-sheen absolute inset-y-0 left-[-38%] w-[34%] rotate-[12deg]" />
        </div>
      ) : null}

      <div className="relative z-10 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[#9db0ca]">{title}</p>
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#2d3949] bg-[#171d26] text-[10px] text-[#8193ad]">
            i
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#2a2f3a] text-lg leading-none text-[#7d8697]">
            ⋮
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <svg viewBox="0 0 120 84" className="w-full">
          <path
            d="M 18 66 A 42 42 0 0 1 102 66"
            pathLength={100}
            fill="none"
            stroke="#242b36"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 18 66 A 42 42 0 0 1 102 66"
            pathLength={100}
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${clampedPercent} 100`}
          />
          <circle cx="60" cy="66" r="24" fill="#171c24" />
          <text x="60" y="61" textAnchor="middle" className="fill-[#f2f5fa] text-[9px] tracking-[0.18em]">
            LIVE
          </text>
          <text x="60" y="78" textAnchor="middle" className="fill-[#7af08f] text-[16px] font-medium">
            {value}
          </text>
        </svg>
      </div>

      <p className="relative z-10 mt-2 text-sm leading-[18px] text-[#8ea0bb]">{hint}</p>
    </article>
  );
}

function ToolbarChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#283342] bg-[#131922] px-3 py-2">
      <p className="text-[10px] tracking-[0.18em] text-[#687991]">{label}</p>
      <p className="mt-1 text-sm text-[#f2f5fa]">{value}</p>
    </div>
  );
}

function FactCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-[#27303d] bg-[linear-gradient(180deg,#191f28_0%,#12171f_100%)] p-4 shadow-[0_16px_36px_rgba(4,8,16,0.2)]">
      <p className="text-[10px] tracking-[0.18em] text-[#7f93af]">{label}</p>
      <p className="mt-3 text-2xl font-medium text-[#f2f5fa]">{value}</p>
      <p className="mt-2 text-sm leading-[18px] text-[#8ea0bb]">{hint}</p>
    </article>
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
        className={`flex h-14 min-w-[120px] w-full items-center justify-between rounded-xl border px-4 text-left transition ${
          disabled
            ? "cursor-not-allowed border-[#222a36] bg-[#10151c] text-[#536277]"
            : isOpen
              ? "border-[#415673] bg-[#17202b] text-[#f2f5fa]"
              : "border-[#2a3443] bg-[#151b24] text-[#f2f5fa] hover:border-[#3c4d64]"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.18em] text-[#687991]">{label}</p>
          <p className="mt-1 truncate text-sm">{value}</p>
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
                  {isActive ? <span className="text-xs text-[#fc7342]">●</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
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

function getGaugeTone(percent: number) {
  if (percent >= 85) {
    return "#ff6b57";
  }

  if (percent >= 65) {
    return "#ffb84d";
  }

  return "#37d04c";
}

function getStatusGauge(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "up") {
    return {
      percent: 96,
      strokeColor: "#37d04c",
      value: "UP",
      hint: "All enabled endpoints are healthy.",
    };
  }

  if (normalized === "degraded") {
    return {
      percent: 62,
      strokeColor: "#ffb84d",
      value: "DEG",
      hint: "Some endpoints are up, but at least one is failing.",
    };
  }

  if (normalized === "down") {
    return {
      percent: 22,
      strokeColor: "#ff6b57",
      value: "DOWN",
      hint: "Enabled endpoints are currently failing.",
    };
  }

  return {
    percent: 40,
    strokeColor: "#7d90ac",
    value: "UNK",
    hint: "No reliable endpoint health signal yet.",
  };
}

function MetricSeriesCard({
  title,
  metric,
  series,
}: {
  title: string;
  metric: MetricKey;
  series: MetricSeriesResponse | null;
}) {
  const points = series?.points ?? [];
  const latestPoint = getLatestPoint(series);
  const palette = getMetricPalette(metric);
  const currentSeverity = latestPoint ? getChartSeverity(metric, latestPoint.value) : null;
  const chartWidth = 640;
  const chartHeight = 220;
  const chartPadding = {
    top: 14,
    right: 12,
    bottom: 32,
    left: 54,
  };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const values = points.map((point) => point.value);
  const rawMinValue = values.length ? Math.min(...values) : 0;
  const rawMaxValue = values.length ? Math.max(...values) : 100;
  const minValue = metric === "network" ? Math.min(rawMinValue, 0) : 0;
  const maxValue =
    metric === "network"
      ? Math.max(rawMaxValue, 1)
      : Math.max(rawMaxValue, 100);
  const valueRange = Math.max(maxValue - minValue, 1);
  const yAxisValues = Array.from({ length: 5 }, (_, index) => maxValue - (valueRange / 4) * index);
  const timeAxisPoints = Array.from(
    new Set(
      [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
        Math.min(points.length - 1, Math.max(0, Math.round((points.length - 1) * ratio))),
      ),
    ),
  )
    .map((targetIndex) => points[targetIndex])
    .filter((point): point is NonNullable<(typeof points)[number]> => Boolean(point));
  const coordinates = points.map((point, index) => {
    const x = chartPadding.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
    const y = chartPadding.top + ((maxValue - point.value) / valueRange) * plotHeight;

    return {
      x,
      y,
      point,
    };
  });
  const linePath = coordinates.map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x} ${coordinate.y}`).join(" ");
  const areaPath = coordinates.length
    ? `${linePath} L ${coordinates.at(-1)?.x ?? chartPadding.left} ${chartHeight - chartPadding.bottom} L ${coordinates[0].x} ${chartHeight - chartPadding.bottom} Z`
    : "";

  return (
    <Panel
      title={title.toUpperCase()}
      subtitle={series?.metric ?? "Prometheus-backed panel"}
      actions={
        <div className="text-right">
          <p className="text-[11px] tracking-[0.18em] text-[#6b7c94]">CURRENT</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <p className="font-mono text-sm text-[#9ec4ff]">{latestPoint ? formatChartValue(metric, latestPoint.value) : "--"}</p>
            {currentSeverity ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${currentSeverity.className}`}>
                {currentSeverity.label}
              </span>
            ) : null}
          </div>
        </div>
      }
    >
      {points.length ? (
        <>
          <div className="relative mt-1 overflow-hidden rounded-xl border border-[#222b38] bg-[linear-gradient(180deg,#122133_0%,#101923_100%)]">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
              {yAxisValues.map((axisValue, index) => {
                const y = chartPadding.top + (index / (yAxisValues.length - 1)) * plotHeight;

                return (
                  <g key={`${metric}-y-${axisValue}`}>
                    <line
                      x1={chartPadding.left}
                      y1={y}
                      x2={chartWidth - chartPadding.right}
                      y2={y}
                      stroke="rgba(123, 139, 165, 0.12)"
                      strokeWidth="1"
                    />
                    <text x={14} y={y + 4} className="fill-[#a1afc5] text-[11px]">
                      {formatAxisValue(metric, axisValue)}
                    </text>
                  </g>
                );
              })}

              {timeAxisPoints.map((point, index) => {
                const x = chartPadding.left + (index / Math.max(timeAxisPoints.length - 1, 1)) * plotWidth;

                return (
                  <g key={`${metric}-x-${point.timestamp}-${index}`}>
                    <line
                      x1={x}
                      y1={chartPadding.top}
                      x2={x}
                      y2={chartHeight - chartPadding.bottom}
                      stroke="rgba(123, 139, 165, 0.08)"
                      strokeWidth="1"
                    />
                    <text x={x - 12} y={chartHeight - 10} className="fill-[#a1afc5] text-[11px]">
                      {formatPointTime(point.timestamp)}
                    </text>
                  </g>
                );
              })}

              <path d={areaPath} fill={palette.fill} />
              <path
                d={linePath}
                fill="none"
                stroke={palette.line}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#d6dfed]">
              <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: palette.line }} />
              <span>{palette.legend}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-mono text-[#6f819c]">{series?.range ?? "No range"}</span>
              <span className="font-mono text-[#89d6ab]">min {formatChartValue(metric, minValue)}</span>
              <span className="font-mono text-[#ffb38f]">max {formatChartValue(metric, rawMaxValue)}</span>
              <span>{latestPoint ? `updated ${formatPointTime(latestPoint.timestamp)}` : "No data"}</span>
              {currentSeverity ? <span className={currentSeverity.className}>{currentSeverity.hint}</span> : null}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-[#8c9eba]">No chart points returned for this server and time range.</p>
      )}
    </Panel>
  );
}

function TopContainersCard({
  title,
  metric,
  response,
  memoryTotalBytes,
}: {
  title: string;
  metric: "cpu" | "memory";
  response: TopContainerMetricResponse | null;
  memoryTotalBytes?: number | null;
}) {
  return (
    <Panel
      title={title.toUpperCase()}
      subtitle="Top N container sample"
      actions={
        <span className="rounded-full border border-[#2b3544] bg-[#131922] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8ea0bb]">
          {metric}
        </span>
      }
    >
      <div className="space-y-2.5">
        {response?.containers.length ? (
          response.containers.slice(0, 5).map((container, index) => {
            const level = getTopContainerLevel(metric, container.value, memoryTotalBytes);
            const displayName = container.containerName?.trim() || container.containerId;
            const showContainerId = container.containerId && container.containerId !== displayName;

            return (
              <div
                key={`${metric}-${container.containerId}-${index}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-[#263041] bg-[linear-gradient(180deg,#121922_0%,#101720_100%)] px-4 py-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1b2430] text-xs font-semibold text-[#9ec4ff]">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6e7f97]">Container</p>
                  <p className="truncate text-base font-semibold text-[#f2f5fa]">{displayName}</p>
                  {showContainerId ? (
                    <p className="truncate font-mono text-xs text-[#8c9eba]">{container.containerId}</p>
                  ) : (
                    <p className="text-xs text-[#8c9eba]">Container ID unavailable</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <p className="font-mono text-base font-semibold text-[#ffb38f]">{formatTopContainerValue(metric, container.value)}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${level.className}`}>
                    {level.label}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[#8c9eba]">No top-container data returned for this server.</p>
        )}
      </div>
    </Panel>
  );
}

export default function MetricsPage() {
  const minimumRefreshFxMs = 850;
  const searchParams = useSearchParams();
  const preferredTenantId = searchParams.get("tenantId") ?? "";
  const preferredServerId = searchParams.get("serverId") ?? "";
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [tenantName, setTenantName] = useState("Metrics");
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [selectedRange, setSelectedRange] = useState<(typeof RANGE_OPTIONS)[number]>(() => {
    const storedRange = readMetricsPreferences().selectedRange;
    return RANGE_OPTIONS.includes(storedRange ?? "1h") ? (storedRange ?? "1h") : "1h";
  });
  const [selectedRefresh, setSelectedRefresh] = useState<RefreshOption["value"]>(() => {
    const storedRefresh = readMetricsPreferences().selectedRefresh;
    return REFRESH_OPTIONS.some((option) => option.value === storedRefresh) ? (storedRefresh ?? "manual") : "manual";
  });
  const [overview, setOverview] = useState<ServerOverviewResponse | null>(null);
  const [seriesByMetric, setSeriesByMetric] = useState<MetricSeriesMap>({
    cpu: null,
    memory: null,
    disk: null,
    network: null,
  });
  const [topCpu, setTopCpu] = useState<TopContainerMetricResponse | null>(null);
  const [topMemory, setTopMemory] = useState<TopContainerMetricResponse | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
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
        description: "Prometheus chart window",
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

  const summaryCards = useMemo(() => {
    if (!overview) {
      return [
        { title: "CPU Busy", value: "--", hint: "No CPU data loaded yet.", percent: 0, strokeColor: "#2f3744" },
        { title: "Memory", value: "--", hint: "No memory data loaded yet.", percent: 0, strokeColor: "#2f3744" },
        { title: "Disk", value: "--", hint: "No disk data loaded yet.", percent: 0, strokeColor: "#2f3744" },
        { title: "Status", value: "--", hint: "Pick a server to inspect.", percent: 0, strokeColor: "#2f3744" },
      ];
    }

    const statusGauge = getStatusGauge(overview.status);

    return [
      {
        title: "CPU Busy",
        value: formatPercent(overview.cpuUsagePercent),
        hint: "Host CPU utilization right now.",
        percent: overview.cpuUsagePercent,
        strokeColor: getGaugeTone(overview.cpuUsagePercent),
      },
      {
        title: "Memory",
        value: formatPercent(overview.memoryUsagePercent),
        hint: "Memory consumption across the host.",
        percent: overview.memoryUsagePercent,
        strokeColor: getGaugeTone(overview.memoryUsagePercent),
      },
      {
        title: "Disk",
        value: formatPercent(overview.diskUsagePercent),
        hint: "Filesystem usage from scraped metrics.",
        percent: overview.diskUsagePercent,
        strokeColor: getGaugeTone(overview.diskUsagePercent),
      },
      {
        title: "Status",
        value: statusGauge.value,
        hint: statusGauge.hint,
        percent: statusGauge.percent,
        strokeColor: statusGauge.strokeColor,
      },
    ];
  }, [overview]);

  const factCards = useMemo(() => {
    if (!overview) {
      return [
        { label: "SYS LOAD", value: "--", hint: "1-minute system load average." },
        { label: "CPU CORES", value: "--", hint: "Detected host CPU core count." },
        { label: "RAM TOTAL", value: "--", hint: "Installed system memory." },
        { label: "ROOTFS TOTAL", value: "--", hint: "Total size of the root filesystem." },
        { label: "UPTIME", value: "--", hint: "Time since last host boot." },
      ];
    }

    return [
      {
        label: "SYS LOAD",
        value: formatLoad(overview.systemLoad1m),
        hint: "1-minute system load average.",
      },
      {
        label: "CPU CORES",
        value: formatInteger(overview.cpuCores),
        hint: "Detected host CPU core count.",
      },
      {
        label: "RAM TOTAL",
        value: formatBytes(overview.memoryTotalBytes),
        hint: "Installed system memory.",
      },
      {
        label: "ROOTFS TOTAL",
        value: formatBytes(overview.diskTotalBytes),
        hint: "Total size of the root filesystem.",
      },
      {
        label: "UPTIME",
        value: formatDurationFromSeconds(overview.uptimeSeconds),
        hint: "Time since last host boot.",
      },
    ];
  }, [overview]);

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

          const storedTenantId = readMetricsPreferences().selectedTenantId;
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
        setError(loadError instanceof Error ? loadError.message : "Unable to load metrics workspace.");
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
        const storedServerId = readMetricsPreferences().selectedServerIdByTenant?.[selectedTenantId];
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

  const loadMetrics = useCallback(async () => {
    if (!selectedTenantId || !selectedServerId) {
      setOverview(null);
      setSeriesByMetric({
        cpu: null,
        memory: null,
        disk: null,
        network: null,
      });
      setTopCpu(null);
      setTopMemory(null);
      return;
    }

    setIsLoadingMetrics(true);
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
      const [nextOverview, cpu, memory, disk, network, nextTopCpu, nextTopMemory] = await Promise.all([
        getServerOverview(accessToken, selectedTenantId, selectedServerId),
        getServerMetricSeries(accessToken, selectedTenantId, selectedServerId, "cpu", selectedRange),
        getServerMetricSeries(accessToken, selectedTenantId, selectedServerId, "memory", selectedRange),
        getServerMetricSeries(accessToken, selectedTenantId, selectedServerId, "disk", selectedRange),
        getServerMetricSeries(accessToken, selectedTenantId, selectedServerId, "network", selectedRange),
        getTopContainers(accessToken, selectedTenantId, selectedServerId, "cpu"),
        getTopContainers(accessToken, selectedTenantId, selectedServerId, "memory"),
      ]);

      setOverview(nextOverview);
      setSeriesByMetric({
        cpu,
        memory,
        disk,
        network,
      });
      setTopCpu(nextTopCpu);
      setTopMemory(nextTopMemory);
      setLastRefreshedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load server metrics.");
    } finally {
      setIsLoadingMetrics(false);
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
  }, [selectedRange, selectedServerId, selectedTenantId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!selectedRefreshOption.intervalMs || !selectedTenantId || !selectedServerId) {
      return;
    }

    const timerId = window.setInterval(() => {
      void loadMetrics();
    }, selectedRefreshOption.intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loadMetrics, selectedRefreshOption, selectedServerId, selectedTenantId]);

  useEffect(() => {
    writeMetricsPreferences((current) => ({
      ...current,
      selectedRange,
      selectedRefresh,
    }));
  }, [selectedRange, selectedRefresh]);

  useEffect(() => {
    if (!selectedTenantId) {
      return;
    }

    writeMetricsPreferences((current) => ({
      ...current,
      selectedTenantId,
    }));
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId || !selectedServerId) {
      return;
    }

    writeMetricsPreferences((current) => ({
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
          <p className="text-sm text-[#8c9eba]">Loading metrics workspace...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,#1a2330_0%,#0d131b_30%,#080d14_100%)] text-[#f2f5fa]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Metrics"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={hrefByItem}
          tenant={{
            label: userRole === "admin" ? "Current View" : "Active Tenant",
            name: selectedServer?.name ?? tenantName,
            serversCount: servers.length,
            onboardingRunning: 0,
            detailLines: selectedServer
              ? [selectedServer.ipAddress, `${selectedServer.environment} environment`]
              : ["Select a server", `${servers.length} servers available`],
            badgeText: "Grafana style",
          }}
        />

        <section className="rounded-[28px] border border-[#202a37] bg-[linear-gradient(180deg,#11161d_0%,#0b1016_100%)] p-5 shadow-[0_28px_80px_rgba(1,4,11,0.45)] md:p-6 lg:min-h-[calc(100vh-4rem)]">
          <div className="rounded-2xl border border-[#252f3d] bg-[linear-gradient(180deg,#171d26_0%,#10151d_100%)] px-5 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] tracking-[0.22em] text-[#fc7342]">DASHBOARDS / INFRASTRUCTURE</p>
                <h1 className="mt-3 text-4xl leading-none text-[#f2f5fa] md:text-5xl">Host Metrics Overview</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8ea0bb]">
                  Grafana-inspired workspace for Prometheus-backed host panels. Tenant, server, and range selection stay in the toolbar so you can pivot fast without leaving the dashboard.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-xl border border-[#2a3443] bg-[#131922] px-3 py-2 text-[11px] tracking-[0.18em] text-[#8ea0bb]">
                  DATASOURCE: PROMETHEUS
                </span>
                <span className="rounded-xl border border-[#3c2a24] bg-[#211512] px-3 py-2 text-[11px] tracking-[0.18em] text-[#ffb38f]">
                  VIA BACKEND API
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <ToolbarChip label="TENANT" value={tenantName || "No tenant"} />
              <ToolbarChip label="SERVER" value={selectedServer?.name ?? "No server"} />
              <ToolbarChip label="RANGE" value={selectedRange} />
              <ToolbarChip label="REFRESH" value={selectedRefreshOption.label} />
            </div>

            <div ref={toolbarRef} className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-[#252f3d] bg-[#0f141b] p-3">
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
                  className="min-w-[170px] flex-1 sm:flex-none"
                />
              ) : null}

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
                className="min-w-[210px] flex-1 sm:flex-none"
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
                className="min-w-[112px] flex-1 sm:flex-none"
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
                className="min-w-[128px] flex-1 sm:flex-none"
              />

              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void loadMetrics();
                  }}
                  className="h-11 rounded-xl bg-[#fc7342] px-4 text-sm text-[#f2f5fa] hover:brightness-110"
                >
                  Refresh now
                </button>
              </div>
            </div>
          </div>

          {error ? <p className="mt-6 text-sm text-[#ff9b7a]">{error}</p> : null}

          {!selectedTenantId ? (
            <div className="mt-6 rounded-2xl border border-[#263246] bg-[#1a212e] p-6">
              <h2 className="text-2xl text-[#f2f5fa]">No tenant selected</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#8c9eba]">
                Create a tenant first, then add servers before opening the metrics workspace.
              </p>
              <Link
                href="/tenants/create"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#fc7342] px-6 text-sm text-[#f2f5fa] hover:brightness-110"
              >
                Create Tenant
              </Link>
            </div>
          ) : null}

          {selectedTenantId && !servers.length ? (
            <div className="mt-6 rounded-2xl border border-[#263246] bg-[#1a212e] p-6">
              <h2 className="text-2xl text-[#f2f5fa]">No servers available</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#8c9eba]">
                Add a server under this tenant before trying to inspect metrics.
              </p>
              <Link
                href="/servers/create"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#fc7342] px-6 text-sm text-[#f2f5fa] hover:brightness-110"
              >
                Add Server
              </Link>
            </div>
          ) : null}

          {selectedTenantId && selectedServer ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <GaugePanel
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    hint={card.hint}
                    percent={card.percent}
                    strokeColor={card.strokeColor}
                    isRefreshing={isLoadingMetrics || isRefreshFxActive}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {factCards.map((card) => (
                  <FactCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
                ))}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ToolbarChip label="SERVER ADDRESS" value={selectedServer.ipAddress} />
              <ToolbarChip label="ENVIRONMENT" value={selectedServer.environment} />
              <ToolbarChip
                label="PANEL STATE"
                value={isLoadingMetrics ? "Refreshing metrics" : `Updated ${formatRefreshTimestamp(lastRefreshedAt)}`}
              />
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <MetricSeriesCard title="CPU Utilization" metric="cpu" series={seriesByMetric.cpu} />
                <MetricSeriesCard title="Memory Utilization" metric="memory" series={seriesByMetric.memory} />
                <MetricSeriesCard title="Disk Utilization" metric="disk" series={seriesByMetric.disk} />
                <MetricSeriesCard title="Network Throughput" metric="network" series={seriesByMetric.network} />
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <TopContainersCard title="Container CPU Leaders" metric="cpu" response={topCpu} />
                <TopContainersCard
                  title="Container Memory Leaders"
                  metric="memory"
                  response={topMemory}
                  memoryTotalBytes={overview?.memoryTotalBytes}
                />
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
