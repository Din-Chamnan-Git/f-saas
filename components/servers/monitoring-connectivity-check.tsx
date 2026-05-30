"use client";

import { useState } from "react";
import { env } from "@/lib/env";
import {
  checkAllServerMetricsEndpoints,
  type ServerMetricsEndpointResponse,
} from "@/services/workspaceService";

type IpKind = "public" | "private" | "loopback" | "link-local" | "hostname" | "invalid";

const ENDPOINT_LABELS: Record<string, string> = {
  node_exporter: "Node exporter (host metrics)",
  cadvisor: "cAdvisor (container metrics)",
  app_metrics: "Application metrics",
};

export function classifyIp(rawValue: string): IpKind {
  const value = rawValue.trim();
  if (!value) {
    return "invalid";
  }

  const octets = value.split(".");
  if (octets.length !== 4) {
    return "hostname";
  }

  const numbers = octets.map((octet) => Number(octet));
  if (numbers.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return "invalid";
  }

  const [first, second] = numbers;
  if (first === 127) {
    return "loopback";
  }
  if (first === 169 && second === 254) {
    return "link-local";
  }
  if (first === 10) {
    return "private";
  }
  if (first === 192 && second === 168) {
    return "private";
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return "private";
  }
  return "public";
}

function endpointLabel(endpointType: string): string {
  return ENDPOINT_LABELS[endpointType] ?? endpointType;
}

function statusTone(status: string): { dot: string; text: string; label: string } {
  const normalized = status.toLowerCase();
  if (normalized === "up") {
    return { dot: "bg-[#3ddc97]", text: "text-[#3ddc97]", label: "Reachable" };
  }
  if (normalized === "down") {
    return { dot: "bg-[#ff6b6b]", text: "text-[#ff6b6b]", label: "Unreachable" };
  }
  return { dot: "bg-[#8c9eba]", text: "text-[#8c9eba]", label: "Not checked yet" };
}

function formatCheckedAt(value: string | null): string {
  if (!value) {
    return "never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

type Props = {
  tenantId: string;
  serverId: string;
  ipAddress: string;
  hasUnsavedChanges: boolean;
};

export default function MonitoringConnectivityCheck({
  tenantId,
  serverId,
  ipAddress,
  hasUnsavedChanges,
}: Props) {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<ServerMetricsEndpointResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ipKind = classifyIp(ipAddress);
  const monitoringServerIp = env.monitoringServerIp;
  const sourceLabel = monitoringServerIp
    ? `the monitoring server (${monitoringServerIp})`
    : "the monitoring server";

  const runCheck = async () => {
    if (!tenantId || !serverId) {
      setError("Tenant and server must be saved before running a connectivity check.");
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const checked = await checkAllServerMetricsEndpoints("", tenantId, serverId);
      setResults(checked);
    } catch (checkError) {
      const message =
        checkError instanceof Error ? checkError.message : "Unable to run connectivity check.";
      setError(message);
      setResults(null);
    } finally {
      setIsChecking(false);
    }
  };

  const enabledResults = (results ?? []).filter((endpoint) => endpoint.isEnabled);
  const downResults = enabledResults.filter((endpoint) => endpoint.lastStatus.toLowerCase() === "down");
  const allUp =
    enabledResults.length > 0 &&
    enabledResults.every((endpoint) => endpoint.lastStatus.toLowerCase() === "up");

  return (
    <div className="mt-8 rounded-[18px] bg-[#1a212e] p-6 ring-1 ring-inset ring-[#202938]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[15px] text-[#f2f5fa]">Monitoring connectivity</p>
          <p className="mt-2 max-w-[560px] text-[13px] leading-[18px] text-[#8c9eba]">
            Probe each metrics endpoint from {sourceLabel}. This is the same network path Prometheus
            uses to scrape, so a failure here means metrics will not appear in the dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={isChecking}
          className="app-button-secondary inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-6 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isChecking ? "Checking..." : "Verify connectivity"}
        </button>
      </div>

      {hasUnsavedChanges ? (
        <p className="mt-4 rounded-[12px] bg-[#2a2418] px-4 py-3 text-[13px] leading-[18px] text-[#f4c87a]">
          You have unsaved changes. Save the server first so the check uses the latest IP and ports.
        </p>
      ) : null}

      {ipKind === "private" || ipKind === "loopback" || ipKind === "link-local" ? (
        <div className="mt-4 rounded-[12px] bg-[#2a1c1c] px-4 py-3 text-[13px] leading-[19px] text-[#ff9b9b]">
          <p className="font-medium text-[#ffb4b4]">
            {ipKind === "private"
              ? "This is a private IP address."
              : ipKind === "loopback"
                ? "This is a loopback address."
                : "This is a link-local address."}
          </p>
          <p className="mt-1 text-[#e6a3a3]">
            {sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1)} usually cannot reach{" "}
            <span className="font-mono">{ipAddress || "this address"}</span> over the internet. Use
            the server&apos;s public IP, or set up NAT port forwarding / a VPN so Prometheus can scrape
            it.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[12px] bg-[#2a1c1c] px-4 py-3 text-[13px] leading-[18px] text-[#ff9b9b]">
          {error}
        </p>
      ) : null}

      {results !== null ? (
        <div className="mt-5 space-y-3">
          {enabledResults.length === 0 ? (
            <p className="text-[13px] leading-[18px] text-[#8c9eba]">
              No enabled metrics endpoints to check. Save monitoring ports first.
            </p>
          ) : (
            enabledResults.map((endpoint) => {
              const tone = statusTone(endpoint.lastStatus);
              return (
                <div
                  key={endpoint.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#171c26] px-4 py-3 ring-1 ring-inset ring-[#222b3a]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    <div>
                      <p className="text-[13px] text-[#f2f5fa]">{endpointLabel(endpoint.endpointType)}</p>
                      <p className="mt-0.5 font-mono text-[12px] text-[#8c9eba]">
                        {endpoint.scheme}://{endpoint.host}:{endpoint.port}
                        {endpoint.path}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13px] font-medium ${tone.text}`}>{tone.label}</p>
                    <p className="mt-0.5 text-[12px] text-[#8c9eba]">
                      Checked: {formatCheckedAt(endpoint.lastCheckedAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {allUp ? (
            <p className="rounded-[12px] bg-[#16271f] px-4 py-3 text-[13px] leading-[18px] text-[#7ee0b0]">
              All endpoints are reachable. Metrics should appear in the dashboard within about 30
              seconds.
            </p>
          ) : null}

          {downResults.length > 0 ? (
            <div className="rounded-[12px] bg-[#1f1a14] px-4 py-3 text-[13px] leading-[19px] text-[#f4c87a]">
              <p className="font-medium text-[#f6d28c]">How to fix unreachable endpoints</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[#d9c39a]">
                <li>Confirm the agent is running on the server and listening on that port.</li>
                <li>
                  Open the firewall for the port, allowing inbound traffic from{" "}
                  {monitoringServerIp ? (
                    <span className="font-mono">{monitoringServerIp}</span>
                  ) : (
                    "the monitoring server's IP"
                  )}
                  .
                </li>
                <li>
                  If the server is behind NAT, forward the port from its public IP to the internal
                  host.
                </li>
                <li>Make sure the IP and port above match where the agent actually listens.</li>
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
