"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Sidebar from "@/components/layouts/sidebar";
import { buildApiUrl } from "@/lib/env";
import { getCurrentUser, type UserRole } from "@/services/authService";
import {
  listAllServers,
  listOnboardingJobs,
  listTenants,
  type OnboardingJobResponse,
  type ServerResponse,
  type TenantResponse,
  startOnboardingJob,
} from "@/services/workspaceService";

export const dynamic = "force-dynamic";

const adminNavItems = ["Dashboard", "Tenants", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const tenantNavItems = ["Dashboard", "Servers", "Onboarding Jobs", "Metrics", "Alerts", "Logs"];
const PLAYBOOK_OPTIONS = [
  "install-basic-monitoring.yml",
  "install-docker-monitoring.yml",
  "install-logs-monitoring.yml",
  "install-full-monitoring.yml",
  "verify-basic-monitoring.yml",
  "verify-docker-monitoring.yml",
  "verify-logs-monitoring.yml",
];
const adminHrefByItem = {
  Dashboard: "/dashboard",
  Tenants: "/tenants",
  Servers: "/servers",
};
const tenantHrefByItem = {
  Dashboard: "/dashboard",
  Servers: "/servers",
};
const LIVE_LOG_STORAGE_KEY = "onboardingLiveLogs";

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed" || normalized === "success") {
    return "text-[#c0f2db] bg-[#1f5b45]";
  }
  if (normalized === "failed") {
    return "text-[#ffd0bf] bg-[#5b2f27]";
  }
  if (normalized === "running" || normalized === "queued" || normalized === "pending") {
    return "text-[#ffe2a7] bg-[#5a4320]";
  }
  return "text-[#b7d6ff] bg-[#243244]";
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

function formatCompactDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimeZoneOffset(value: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "Local time";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "Local time";
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) {
    return "Still running";
  }

  const start = new Date(startedAt).getTime();
  const finish = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(finish) || finish <= start) {
    return "Runtime unavailable";
  }

  const totalMinutes = Math.round((finish - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function prettifyStatus(status: string) {
  return status.replace(/[_-]+/g, " ");
}

function isRestartInterrupted(job: OnboardingJobResponse) {
  return (job.errorMessage ?? "").toLowerCase().includes("interrupted by backend restart");
}

function getJobHeadline(job: OnboardingJobResponse) {
  if (isRestartInterrupted(job)) {
    return "Recovered after backend restart";
  }

  const normalizedStatus = job.status.trim().toLowerCase();
  if (normalizedStatus === "success" || normalizedStatus === "completed") {
    return "Completed successfully";
  }

  if (normalizedStatus === "failed") {
    return job.errorMessage ?? "Execution failed";
  }

  if (["pending", "queued", "running"].includes(normalizedStatus)) {
    return "Streaming live execution updates";
  }

  return "Execution details captured for this run";
}

function buildTimeline(job: OnboardingJobResponse) {
  const steps = ["Job created and queued"];

  if (job.startedAt) {
    steps.push("Ansible launched with runtime inventory");
  }

  if (job.output || job.outputRef) {
    steps.push("Output preview saved and raw log uploaded");
  } else if (job.finishedAt) {
    steps.push("Execution finished and no artifact was stored");
  }

  return steps;
}

function buildInventoryAlias(server: ServerResponse | undefined) {
  if (!server) {
    return "";
  }

  const preferredSource = server.instance?.trim() || server.name?.trim() || "";
  const sanitized = preferredSource
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized) {
    return sanitized;
  }

  return `server-${server.id.slice(0, 8)}`;
}

function parseSseChunk(chunk: string) {
  const lines = chunk.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  const rawData = dataLines.join("\n");
  if (!rawData) {
    return null;
  }

  try {
    return {
      eventName,
      payload: JSON.parse(rawData) as Record<string, unknown>,
    };
  } catch {
    return {
      eventName,
      payload: { message: rawData },
    };
  }
}

function readStoredLiveLogs(): Record<string, string[]> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(LIVE_LOG_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredLiveLogs(nextValue: Record<string, string[]>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(LIVE_LOG_STORAGE_KEY, JSON.stringify(nextValue));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Check the backend response and browser network tab.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

function getProgressModel(job: OnboardingJobResponse | null) {
  if (!job) {
    return {
      percent: 0,
      toneClass: "bg-[#2b3c58]",
      label: "Waiting for a job to start",
      hint: "Select a company, server, and playbook to launch onboarding.",
      stepIndex: -1,
    };
  }

  const normalizedStatus = job.status.trim().toLowerCase();

  if (normalizedStatus === "pending" || normalizedStatus === "queued") {
    return {
      percent: 18,
      toneClass: "bg-[#7eb4ff]",
      label: "Queued",
      hint: "Job created and waiting for the executor to launch Ansible.",
      stepIndex: 0,
    };
  }

  if (normalizedStatus === "running") {
    return {
      percent: job.output ? 78 : 56,
      toneClass: "bg-[#ffb24c]",
      label: "Running",
      hint: job.output ? "Output preview is being collected while the job is still active." : "Ansible is running against the selected server.",
      stepIndex: job.output ? 2 : 1,
    };
  }

  if (normalizedStatus === "success" || normalizedStatus === "completed") {
    return {
      percent: 100,
      toneClass: "bg-[#38c172]",
      label: "Success",
      hint: "The onboarding run finished successfully and artifacts are available.",
      stepIndex: 2,
    };
  }

  if (normalizedStatus === "failed") {
    return {
      percent: 100,
      toneClass: "bg-[#ff7a7a]",
      label: "Failed",
      hint: job.errorMessage ?? "The job failed before completion.",
      stepIndex: 2,
    };
  }

  return {
    percent: 32,
    toneClass: "bg-[#2b3c58]",
    label: prettifyStatus(job.status),
    hint: "Job status is available but not mapped to a specific progress state.",
    stepIndex: 1,
  };
}

function ProgressStage({
  index,
  title,
  active,
  complete,
}: {
  index: number;
  title: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className={`rounded-[12px] px-4 py-3 ${active ? "bg-[#243244]" : "bg-[#182131]"}`}>
      <p className={`text-[12px] font-medium ${complete || active ? "text-[#f2f6ff]" : "text-[#9ba8bf]"}`}>
        {index + 1}. {title}
      </p>
    </div>
  );
}

function DetailCard({
  title,
  value,
  hint,
  valueClassName,
  hintClassName,
}: {
  title: string;
  value: ReactNode;
  hint: ReactNode;
  valueClassName?: string;
  hintClassName?: string;
}) {
  return (
    <article className="app-card rounded-[18px] p-[18px]">
      <p className="app-text-soft text-[13px]">{title}</p>
      <div className={`mt-2 text-[26px] font-semibold leading-[1.05] text-[var(--app-text)] ${valueClassName ?? ""}`}>{value}</div>
      <div className={`app-text-soft mt-3 text-[13px] leading-[18px] ${hintClassName ?? ""}`}>{hint}</div>
    </article>
  );
}

export default function TasksPage() {
  const searchParams = useSearchParams();
  const preselectedTenantId = searchParams.get("tenantId") ?? "";
  const preselectedServerId = searchParams.get("serverId") ?? "";
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [jobs, setJobs] = useState<OnboardingJobResponse[]>([]);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState(preselectedTenantId);
  const [selectedServerId, setSelectedServerId] = useState(preselectedServerId);
  const [selectedPlaybookName, setSelectedPlaybookName] = useState(PLAYBOOK_OPTIONS[0]);
  const [inventoryHostAlias, setInventoryHostAlias] = useState("");
  const [liveLogLines, setLiveLogLines] = useState<string[]>([]);
  const [streamState, setStreamState] = useState<"idle" | "connecting" | "live" | "closed" | "error">("idle");
  const [loadingStage, setLoadingStage] = useState("Checking session");
  const [error, setError] = useState<string | null>(null);
  const activeStreamJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      setIsLoading(true);
      setLoadingStage("Checking session");
      setError(null);

      try {
        const accessToken = "";
        const currentUser = await withTimeout(getCurrentUser(accessToken), 10000, "Current user request");
        const normalizedRole = currentUser.role.toLowerCase() as UserRole;
        setUserRole(normalizedRole);

        if (normalizedRole !== "admin") {
          setJobs([]);
          return;
        }

        setLoadingStage("Loading jobs, companies, and servers");
        const [jobRows, tenantRows, serverRows] = await Promise.all([
          withTimeout(listOnboardingJobs(accessToken), 15000, "Onboarding jobs request"),
          withTimeout(listTenants(accessToken), 15000, "Tenant list request"),
          withTimeout(listAllServers(accessToken), 15000, "Server list request"),
        ]);
        setJobs(jobRows);
        setTenants(tenantRows);
        setServers(serverRows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load onboarding jobs.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadJobs();
  }, []);

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return rightTime - leftTime;
      }),
    [jobs],
  );
  const scopedJobs = useMemo(() => {
    if (selectedServerId) {
      return sortedJobs.filter((job) => job.serverId === selectedServerId);
    }

    if (selectedTenantId) {
      return sortedJobs.filter((job) => job.tenantId === selectedTenantId);
    }

    return sortedJobs;
  }, [selectedServerId, selectedTenantId, sortedJobs]);
  const selectedJob = useMemo(
    () => scopedJobs.find((job) => job.jobId === trackedJobId) ?? scopedJobs[0] ?? null,
    [scopedJobs, trackedJobId],
  );
  const tenantNameById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant.name])), [tenants]);
  const serverNameById = useMemo(() => new Map(servers.map((server) => [server.id, server.name])), [servers]);
  const runningCount = jobs.filter((job) => ["running", "queued", "pending"].includes(job.status.toLowerCase())).length;
  const navItems = userRole === "admin" ? adminNavItems : tenantNavItems;
  const availableServers = useMemo(
    () => servers.filter((server) => server.tenantId === selectedTenantId),
    [selectedTenantId, servers],
  );
  const selectedServer = useMemo(() => servers.find((server) => server.id === selectedServerId) ?? null, [selectedServerId, servers]);
  const selectedTenantName = selectedJob ? tenantNameById.get(selectedJob.tenantId) ?? "Unknown tenant" : "No tenant";
  const selectedServerName = selectedJob ? serverNameById.get(selectedJob.serverId) ?? "Unknown server" : "No server";
  const timelineSteps = selectedJob ? buildTimeline(selectedJob) : [];
  const storageBucket = "monitor-saas";
  const progressModel = getProgressModel(selectedJob);
  const progressStages = ["Job created", "Ansible running", "Output stored"];
  const isStreamingLogs = streamState === "live" || streamState === "connecting";
  const outputConsole =
    isStreamingLogs && liveLogLines.length
      ? liveLogLines.join("\n")
      : selectedJob?.output ?? (liveLogLines.length ? liveLogLines.join("\n") : "No output preview stored for this run.");
  const selectedJobId = selectedJob?.jobId ?? null;
  const selectedJobStatus = selectedJob?.status.trim().toLowerCase() ?? null;
  const shouldTrackActiveJob =
    userRole === "admin" && !!selectedJobId && !!selectedJobStatus && ["pending", "queued", "running"].includes(selectedJobStatus);
  const historyGroups = useMemo(() => {
    const totalJobs = scopedJobs.length;
    const grouped = new Map<string, Array<{ job: OnboardingJobResponse; buildNumber: number }>>();

    scopedJobs.forEach((job, index) => {
      const groupKey = formatHistoryDate(job.createdAt);
      const existing = grouped.get(groupKey) ?? [];
      existing.push({
        job,
        buildNumber: totalJobs - index,
      });
      grouped.set(groupKey, existing);
    });

    return Array.from(grouped.entries()).map(([label, items]) => ({
      label,
      items,
    }));
  }, [scopedJobs]);

  useEffect(() => {
    if (preselectedTenantId) {
      setSelectedTenantId(preselectedTenantId);
    }

    if (preselectedServerId) {
      setSelectedServerId(preselectedServerId);
    }
  }, [preselectedServerId, preselectedTenantId]);

  const reloadJobRows = async () => {
    try {
      const jobRows = await listOnboardingJobs("");
      setJobs(jobRows);
    } catch (reloadError) {
      const message = reloadError instanceof Error ? reloadError.message : "Unable to refresh onboarding jobs.";
      setError((currentError) => currentError ?? message);
    }
  };

  useEffect(() => {
    if (userRole !== "admin") {
      return;
    }

    if (!selectedTenantId) {
      const nextTenantId = selectedJob?.tenantId ?? tenants[0]?.id ?? "";
      if (nextTenantId) {
        setSelectedTenantId(nextTenantId);
      }
    }
  }, [selectedJob, selectedTenantId, tenants, userRole]);

  useEffect(() => {
    if (userRole !== "admin") {
      return;
    }

    const nextServer =
      availableServers.find((server) => server.id === selectedServerId) ??
      availableServers.find((server) => server.id === selectedJob?.serverId) ??
      availableServers[0];

    if (nextServer && nextServer.id !== selectedServerId) {
      setSelectedServerId(nextServer.id);
      setInventoryHostAlias(buildInventoryAlias(nextServer));
      return;
    }

    if (!nextServer && selectedServerId) {
      setSelectedServerId("");
      setInventoryHostAlias("");
    }
  }, [availableServers, selectedJob, selectedServerId, userRole]);

  useEffect(() => {
    if (!selectedJob || selectedPlaybookName !== PLAYBOOK_OPTIONS[0]) {
      return;
    }

    setSelectedPlaybookName(selectedJob.playbookName);
  }, [selectedJob, selectedPlaybookName]);

  useEffect(() => {
    if (!selectedJobId) {
      setLiveLogLines([]);
      setStreamState("idle");
      return;
    }

    const storedLogs = readStoredLiveLogs();
    setLiveLogLines(storedLogs[selectedJobId] ?? []);
    setStreamState("idle");
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    const storedLogs = readStoredLiveLogs();
    if (liveLogLines.length > 0) {
      storedLogs[selectedJobId] = liveLogLines.slice(-800);
    } else {
      delete storedLogs[selectedJobId];
    }
    writeStoredLiveLogs(storedLogs);
  }, [liveLogLines, selectedJobId]);

  useEffect(() => {
    if (!shouldTrackActiveJob) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void reloadJobRows();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [shouldTrackActiveJob]);

  useEffect(() => {
    if (!shouldTrackActiveJob || !selectedJobId) {
      return;
    }

    if (activeStreamJobIdRef.current === selectedJobId) {
      return;
    }

    const controller = new AbortController();

    const connectStream = async () => {
      activeStreamJobIdRef.current = selectedJobId;
      setStreamState("connecting");

      try {
        const response = await fetch(buildApiUrl(`/api/v1/onboarding/jobs/${selectedJobId}/stream`), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Unable to open job stream.");
        }

        setStreamState("live");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyJobPatch = (payload: Record<string, unknown>) => {
          const jobId = typeof payload.jobId === "string" ? payload.jobId : selectedJobId;
          setJobs((currentJobs) =>
            currentJobs.map((job) =>
              job.jobId === jobId
                ? {
                    ...job,
                    status: typeof payload.status === "string" ? payload.status : job.status,
                    startedAt: typeof payload.startedAt === "string" || payload.startedAt === null ? payload.startedAt : job.startedAt,
                    finishedAt:
                      typeof payload.finishedAt === "string" || payload.finishedAt === null ? payload.finishedAt : job.finishedAt,
                    output:
                      typeof payload.outputPreview === "string"
                        ? payload.outputPreview
                        : typeof payload.output === "string"
                          ? payload.output
                          : job.output,
                    outputRef:
                      typeof payload.outputRef === "string" || payload.outputRef === null ? payload.outputRef : job.outputRef,
                    errorMessage:
                      typeof payload.errorMessage === "string" || payload.errorMessage === null
                        ? payload.errorMessage
                        : job.errorMessage,
                  }
                : job,
            ),
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const parsed = parseSseChunk(chunk.trim());
            if (!parsed) {
              continue;
            }

            if (parsed.eventName === "snapshot" || parsed.eventName === "status") {
              applyJobPatch(parsed.payload);
              continue;
            }

            if (parsed.eventName === "log") {
              const line = typeof parsed.payload.line === "string" ? parsed.payload.line : "";
              setLiveLogLines((currentLines) => [...currentLines, line].slice(-800));
              continue;
            }

            if (parsed.eventName === "finished" || parsed.eventName === "failed") {
              applyJobPatch(parsed.payload);
              activeStreamJobIdRef.current = null;
              setStreamState("closed");
            }
          }
        }

        if (!controller.signal.aborted) {
          activeStreamJobIdRef.current = null;
          setStreamState("closed");
        }
      } catch (streamError) {
        if (controller.signal.aborted) {
          return;
        }

        activeStreamJobIdRef.current = null;
        const message = streamError instanceof Error ? streamError.message : "Unable to stream onboarding job.";
        setError((currentError) => currentError ?? message);
        setStreamState("error");
      }
    };

    void connectStream();

    return () => {
      activeStreamJobIdRef.current = null;
      controller.abort();
    };
  }, [selectedJobId, shouldTrackActiveJob]);

  const handleStartJob = async () => {
    if (!selectedTenantId || !selectedServerId || !selectedPlaybookName) {
      setError("Select a company, server, and playbook before starting onboarding.");
      return;
    }

    const normalizedInventoryHostAlias = inventoryHostAlias.trim();
    if (!normalizedInventoryHostAlias) {
      setError("Inventory host alias is required.");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedInventoryHostAlias)) {
      setError("Inventory host alias can only use letters, numbers, dots, underscores, or hyphens.");
      return;
    }

    setIsStartingJob(true);
    setError(null);

    try {
      const startedJob = await startOnboardingJob("", {
        tenantId: selectedTenantId,
        serverId: selectedServerId,
        playbookName: selectedPlaybookName,
        inventoryHost: normalizedInventoryHostAlias,
      });
      setTrackedJobId(startedJob.jobId);
      setJobs((currentJobs) => [startedJob, ...currentJobs.filter((job) => job.jobId !== startedJob.jobId)]);
      await reloadJobRows();
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unable to start onboarding job.";
      setError(message);
    } finally {
      setIsStartingJob(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
        <main className="grid min-h-screen w-full place-items-center p-6">
          <div className="text-center">
            <p className="app-text-soft text-sm">Loading onboarding jobs...</p>
            <p className="app-text-faint mt-3 text-[12px]">{loadingStage}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-bg min-h-screen w-full text-[var(--app-text)]">
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[272px_1fr] lg:gap-6 lg:p-6">
        <Sidebar
          navItems={navItems}
          activeItem="Onboarding Jobs"
          sectionLabel={userRole === "admin" ? "ADMIN CONSOLE" : "OPERATIONS"}
          hrefByItem={userRole === "admin" ? adminHrefByItem : tenantHrefByItem}
          tenant={{
            label: userRole === "admin" ? "Latest Job" : "Access Scope",
            name: userRole === "admin" ? selectedJob?.playbookName.replace(/\.ya?ml$/i, "") ?? "No jobs" : "Tenant workspace",
            serversCount: 0,
            onboardingRunning: runningCount,
            detailLines:
              userRole === "admin"
                ? [
                    selectedJob ? prettifyStatus(selectedJob.status) : "No job selected",
                    selectedJob?.outputRef ? "R2 log stored and preview ready" : "Preview or artifact not available yet",
                  ]
                : ["Onboarding jobs are admin-only in the current backend policy", "Use workspace pages for tenant operations"],
          }}
        />

        {userRole !== "admin" ? (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Admin-only area</h1>
            <p className="app-text-soft mt-4 max-w-2xl text-[15px] leading-[22px]">
              Onboarding job history is currently restricted to platform admins. Owner and member users can still manage
              tenant-scoped servers, but this page will stay read-only until backend policy changes.
            </p>
            <Link
              href="/dashboard"
              className="app-button-secondary mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium"
            >
              Back to Workspace
            </Link>
          </section>
        ) : (
          <section className="app-panel rounded-3xl p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[42px] font-semibold leading-none text-[var(--app-text)]">Onboarding Job</h1>
                <p className="app-text-soft mt-3 max-w-[760px] text-[14px]">
                  Inspect execution status, output preview, and log storage details for one onboarding run.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleStartJob();
                }}
                disabled={!selectedTenantId || !selectedServerId || !selectedPlaybookName || isStartingJob}
                className="app-button-primary inline-flex h-11 items-center justify-center rounded-[14px] px-6 text-sm font-semibold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingJob ? "Running..." : "Run Job"}
              </button>
            </div>

            {error ? <p className="mt-6 text-sm text-[#ff9b7a]">{error}</p> : null}

            <section className="app-card mt-8 rounded-[18px] p-6">
              <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr_1.15fr]">
                <label className="block">
                  <span className="app-text-soft text-[13px]">Company</span>
                  <select
                    value={selectedTenantId}
                    onChange={(event) => setSelectedTenantId(event.target.value)}
                    className="app-input mt-3 h-[54px] w-full rounded-[14px] px-4 text-[14px] outline-none focus:border-[#7eb4ff]"
                  >
                    <option value="" disabled>
                      Select company
                    </option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Server</span>
                  <select
                    value={selectedServerId}
                    onChange={(event) => {
                      const nextServer = availableServers.find((server) => server.id === event.target.value);
                      setSelectedServerId(event.target.value);
                      setInventoryHostAlias(buildInventoryAlias(nextServer));
                    }}
                    className="app-input mt-3 h-[54px] w-full rounded-[14px] px-4 text-[14px] outline-none focus:border-[#7eb4ff]"
                  >
                    <option value="" disabled>
                      Select server
                    </option>
                    {availableServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Playbook</span>
                  <select
                    value={selectedPlaybookName}
                    onChange={(event) => setSelectedPlaybookName(event.target.value)}
                    className="app-input mt-3 h-[54px] w-full rounded-[14px] px-4 text-[14px] outline-none focus:border-[#7eb4ff]"
                  >
                    {PLAYBOOK_OPTIONS.map((playbookName) => (
                      <option key={playbookName} value={playbookName}>
                        {playbookName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="app-text-soft text-[13px]">Inventory host alias</span>
                  <input
                    type="text"
                    value={inventoryHostAlias}
                    onChange={(event) => setInventoryHostAlias(event.target.value)}
                    placeholder="server-alias"
                    className="app-input mt-3 h-[54px] w-full rounded-[14px] px-4 text-[14px] outline-none focus:border-[#7eb4ff]"
                  />
                </label>
              </div>

              <p className="app-text-soft mt-4 text-[13px]">
                Choose the company, target server, and playbook before starting onboarding. The inventory alias must use
                only letters, numbers, dots, underscores, or hyphens.
              </p>
              {selectedServer ? (
                <p className="mt-2 text-[13px] text-[#7eb4ff]">
                  SSH target: {selectedServer.ansibleHost} as {selectedServer.ansibleUser}
                </p>
              ) : null}
            </section>

            <section className="app-card mt-6 rounded-[18px] p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Job Progress</h2>
                  <p className="app-text-soft mt-2 text-[13px]">{progressModel.hint}</p>
                </div>
                <span className={`inline-flex rounded-full px-4 py-1.5 text-[12px] font-medium text-white ${progressModel.toneClass}`}>
                  {progressModel.label}
                </span>
              </div>

              <div className="app-panel-soft mt-6 rounded-full p-1">
                <div
                  className={`h-4 rounded-full transition-all duration-700 ${progressModel.toneClass} ${
                    progressModel.label === "Running" ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${progressModel.percent}%` }}
                />
              </div>

              <div className="app-text-soft mt-3 flex items-center justify-between text-[12px]">
                <span>{selectedJob ? `Tracking job ${selectedJob.jobId}` : "No active job selected"}</span>
                <span className="inline-flex items-center gap-2">
                  {streamState === "connecting" ? (
                    <>
                      Connecting <LoadingDots />
                    </>
                  ) : streamState === "live" ? (
                    <>
                      Live stream connected <LoadingDots />
                    </>
                  ) : (
                    `${progressModel.percent}%`
                  )}
                </span>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {progressStages.map((stage, index) => (
                  <ProgressStage
                    key={stage}
                    index={index}
                    title={stage}
                    active={progressModel.stepIndex === index}
                    complete={progressModel.stepIndex > index || progressModel.percent === 100}
                  />
                ))}
              </div>
            </section>

            {!selectedJob ? (
              <div className="app-card mt-8 rounded-[18px] p-6">
                <p className="text-[15px] text-[var(--app-text)]">No onboarding jobs yet.</p>
                <p className="app-text-soft mt-2 text-sm">
                  Start an onboarding run after creating a server and this screen will populate with the latest job detail.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_292px]">
                <div>
                  <section className="app-card rounded-[18px] p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[var(--app-text)]">{selectedJob.playbookName}</h2>
                        <p className="app-text-soft mt-3 text-[13px]">Job ID: {selectedJob.jobId}</p>
                        <p className="mt-3 text-[13px] text-[#7eb4ff]">
                          Tenant: {selectedTenantName} • Server: {selectedServerName}
                        </p>
                        <p className="mt-3 text-[13px] text-[#d3d9e5]">
                          {getJobHeadline(selectedJob)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <span className={`inline-flex rounded-full px-4 py-1.5 text-[12px] font-medium ${getStatusTone(selectedJob.status)}`}>
                          {prettifyStatus(selectedJob.status)}
                        </span>
                        {isRestartInterrupted(selectedJob) ? (
                          <span className="inline-flex rounded-full bg-[#243244] px-4 py-1.5 text-[12px] font-medium text-[#b7d6ff]">
                            Recovered after restart
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full bg-[#2b3c58] px-4 py-1.5 text-[12px] font-medium text-[#d8e3f7]">
                          {selectedJob.outputRef ? "R2 stored" : "DB only"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DetailCard
                      title="Started"
                      value={formatCompactDateTime(selectedJob.startedAt ?? selectedJob.createdAt)}
                      hint={`${formatTimeZoneOffset(selectedJob.startedAt ?? selectedJob.createdAt)} • ${
                        selectedJob.startedAt ? "Queued and launched" : "Waiting to launch"
                      }`}
                      valueClassName="text-[22px] sm:text-[24px]"
                    />
                    <DetailCard
                      title="Finished"
                      value={formatCompactDateTime(selectedJob.finishedAt)}
                      hint={
                        selectedJob.finishedAt
                          ? `${formatTimeZoneOffset(selectedJob.finishedAt)} • Runtime ${formatDuration(selectedJob.startedAt, selectedJob.finishedAt)}`
                          : "Job still running"
                      }
                      valueClassName="text-[22px] sm:text-[24px]"
                    />
                    <DetailCard
                      title="Output"
                      value={selectedJob.output ? "Preview ready" : "No preview"}
                      hint={selectedJob.output ? "DB preview available" : "No preview available yet"}
                      valueClassName="text-[22px] sm:text-[24px]"
                    />
                    <DetailCard
                      title="Artifact"
                      value={selectedJob.outputRef ? "R2 object key" : "Not stored"}
                      hint={selectedJob.outputRef ?? "No object key uploaded"}
                      valueClassName="text-[22px] sm:text-[24px]"
                      hintClassName="break-all text-[12px] text-[#9ba8bf]"
                    />
                  </div>

                  <section className="app-card mt-6 rounded-[18px] p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Output Preview</h2>
                        <p className="app-text-soft mt-2 text-[13px]">
                          {isStreamingLogs
                            ? "Live console output from the running job. This buffer stays in the browser while you switch tabs."
                            : liveLogLines.length
                              ? "Buffered console output restored from this browser session."
                              : "Short preview stored in DB for fast UI reads."}
                        </p>
                      </div>
                      <span className="app-panel-soft inline-flex rounded-full px-4 py-1.5 text-[12px] font-medium text-[#d8e3f7]">
                        {streamState === "connecting"
                          ? "Connecting to live logs"
                          : streamState === "live"
                            ? "Streaming live logs"
                            : liveLogLines.length
                              ? "Buffered logs"
                              : "Stored preview"}
                      </span>
                    </div>
                    {isStreamingLogs ? (
                      <div className="app-panel-soft mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] text-[#d8e3f7]">
                        <LoadingDots />
                        <span>Collecting output from Ansible</span>
                      </div>
                    ) : null}
                    <div className="app-panel-soft mt-6 max-h-[520px] overflow-auto rounded-[14px] p-6">
                      <pre className="overflow-x-auto whitespace-pre-wrap text-[13px] leading-[1.45] text-[#dce3f0]">
                        {outputConsole}
                      </pre>
                    </div>
                  </section>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <section className="app-card rounded-[18px] p-6">
                      <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Storage Details</h2>
                      <p className="app-text-soft mt-2 text-[13px]">Artifact location and retention hints.</p>
                      <div className="app-panel-soft mt-6 rounded-[12px] px-5 py-4">
                        <p className="app-text-soft text-[12px] font-medium">Bucket</p>
                        <p className="mt-2 text-[13px] text-[var(--app-text)]">{storageBucket}</p>
                      </div>
                      <div className="app-panel-soft mt-4 rounded-[12px] px-5 py-4">
                        <p className="app-text-soft text-[12px] font-medium">Object key</p>
                        <p className="mt-2 break-all text-[13px] text-[var(--app-text)]">{selectedJob.outputRef ?? "No object key stored for this job."}</p>
                      </div>
                    </section>

                    <section className="app-card rounded-[18px] p-6">
                      <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Job Timeline</h2>
                      <p className="app-text-soft mt-2 text-[13px]">High-level execution steps for operators.</p>
                      <div className="mt-6 space-y-3">
                        {timelineSteps.map((step, index) => (
                          <div key={`${index + 1}-${step}`} className="app-panel-soft rounded-[12px] px-5 py-3">
                            <p className="text-[13px] text-[#dce3f0]">
                              {index + 1}. {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <aside className="app-card rounded-[18px] p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-5rem)] xl:overflow-auto">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[18px] font-semibold text-[var(--app-text)]">Run History</h2>
                      <p className="app-text-soft mt-2 text-[13px]">Recent onboarding executions, grouped like build history.</p>
                    </div>
                    <span className="app-panel-soft inline-flex rounded-full px-3 py-1 text-[12px] font-medium text-[#d8e3f7]">
                      {scopedJobs.length}
                    </span>
                  </div>

                  <div className="mt-5 space-y-5">
                    {historyGroups.map((group) => (
                      <div key={group.label}>
                        <p className="app-text-faint text-[12px] font-medium uppercase tracking-[0.12em]">{group.label}</p>
                        <div className="mt-3 space-y-2">
                          {group.items.map(({ job, buildNumber }) => {
                            const normalizedStatus = job.status.trim().toLowerCase();
                            const statusIconClass =
                              normalizedStatus === "success" || normalizedStatus === "completed"
                                ? "border-[#29d17d] text-[#29d17d]"
                                : normalizedStatus === "failed"
                                  ? "border-[#ff6f61] text-[#ff6f61]"
                                  : "border-[#ffb24c] text-[#ffb24c]";

                            return (
                              <button
                                key={job.jobId}
                                type="button"
                                onClick={() => setTrackedJobId(job.jobId)}
                                className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-3 py-3 text-left transition ${
                                  job.jobId === selectedJobId
                                    ? "border-[#7eb4ff] bg-[#1b2736]"
                                    : "border-[#263246] bg-[#182131] hover:border-[#44536a]"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${statusIconClass}`}>
                                    {normalizedStatus === "success" || normalizedStatus === "completed" ? "✓" : normalizedStatus === "failed" ? "x" : "•"}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-medium text-[var(--app-text)]">#{buildNumber}</p>
                                    <p className="app-text-soft truncate text-[12px]">{job.playbookName}</p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-[12px] text-[#dce3f0]">{formatHistoryTime(job.createdAt)}</p>
                                  <p className="mt-1 text-[11px] text-[#7f90ac]">{prettifyStatus(job.status)}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
