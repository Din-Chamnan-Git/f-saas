import Link from "next/link";
import type { ServerRow } from "@/types/server";

const environmentBadgeClasses: Record<ServerRow["environment"], string> = {
  development: "bg-[#223244] border-[#335174] text-[#9ec4ff]",
  production: "bg-[#3b2e20] border-[#705532] text-[#ffb96d]",
  staging: "bg-[#27263d] border-[#454071] text-[#9ca8ff]",
};

const onboardingBadgeClasses: Record<ServerRow["onboarding"], string> = {
  success: "bg-[#244530] border-[#244530] text-[#bff2c7]",
  running: "bg-[#4a3922] border-[#4a3922] text-[#f9d9a7]",
  failed: "bg-[#4a2525] border-[#4a2525] text-[#ffb7b7]",
};

function BellIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.2 17.4a3 3 0 0 1-6.4 0m7.2 0H5.8c1.1-1.1 1.8-2.5 1.8-4.1V9.8A4.4 4.4 0 0 1 12 5.4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.9 4.5a4.3 4.3 0 0 1 4.4 4.3v2.5c0 .9.2 1.8.6 2.6"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.2 17.4H8.8c1.1-1.1 1.8-2.5 1.8-4.1V9.8A4.4 4.4 0 0 1 15 5.4a4.3 4.3 0 0 1 4.4 4.3v3.6c0 1.6.7 3 1.8 4.1H15.2Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17.4a2 2 0 0 0 4 0" />
    </svg>
  );
}

type ServerCardProps = {
  server: ServerRow;
  alertMuted?: boolean;
  isAlertToggleLoading?: boolean;
  onToggleAlerts?: () => void;
};

export default function ServerCard({ server, alertMuted, isAlertToggleLoading, onToggleAlerts }: ServerCardProps) {
  const openHref = server.id && server.tenantId ? `/metrics?tenantId=${server.tenantId}&serverId=${server.id}` : undefined;
  const detailsHref = server.id && server.tenantId ? `/servers/${server.id}?tenantId=${server.tenantId}` : undefined;
  const verifyHref = server.id && server.tenantId ? `/jobs?tenantId=${server.tenantId}&serverId=${server.id}` : undefined;
  const editHref = server.id && server.tenantId ? `/servers/${server.id}/edit?tenantId=${server.tenantId}` : undefined;
  const primaryHref = server.primaryAction === "Verify" ? verifyHref : openHref;
  const canToggleAlerts = typeof alertMuted === "boolean" && onToggleAlerts;

  return (
    <article className="app-card rounded-2xl p-4 md:grid md:grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr] md:items-center md:gap-3">
      <div>
        <p className="text-xl text-[var(--app-text)] md:text-lg">{server.name}</p>
        <p className="app-text-soft mt-1 text-sm">{server.tenantName ? `${server.tenantName} • ${server.ip}` : server.ip}</p>
      </div>

      <div className="mt-3 md:mt-0">
        <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${environmentBadgeClasses[server.environment]}`}>
          {server.environment}
        </span>
      </div>

      <div className="mt-3 md:mt-0">
        <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${onboardingBadgeClasses[server.onboarding]}`}>
          {server.onboarding}
        </span>
      </div>

      <p className="app-text-soft mt-3 text-sm md:mt-0">{server.metrics}</p>
      <p className="app-text-soft mt-1 text-sm md:mt-0">{server.logs}</p>

      <div className="mt-4 flex gap-2 md:mt-0 md:justify-end">
        {canToggleAlerts ? (
          <button
            type="button"
            onClick={() => onToggleAlerts?.()}
            disabled={isAlertToggleLoading}
            title={alertMuted ? "Unmute alerts" : "Mute alerts"}
            aria-label={alertMuted ? "Unmute alerts for this server" : "Mute alerts for this server"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition disabled:opacity-60 ${
              alertMuted
                ? "bg-[#0f766e] text-white hover:bg-[#115e59]"
                : "bg-[#3b2e20] text-[#ffb96d] hover:bg-[#4b3929]"
            }`}
          >
            {isAlertToggleLoading ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 animate-spin fill-none stroke-current stroke-[1.8]"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 1 1-3.3-6.9"
                />
              </svg>
            ) : (
              <BellIcon muted={Boolean(alertMuted)} />
            )}
            <span className="sr-only">{isAlertToggleLoading ? "Updating alert mute state" : alertMuted ? "Unmute alerts" : "Mute alerts"}</span>
          </button>
        ) : null}
        <Link
          href={primaryHref ?? "#"}
          className={`app-button-primary inline-flex h-9 items-center rounded-xl px-4 text-sm hover:brightness-110 ${primaryHref ? "" : "pointer-events-none opacity-70"}`}
        >
          {server.primaryAction}
        </Link>
        <Link
          href={detailsHref ?? "#"}
          className={`app-button-secondary inline-flex h-9 items-center rounded-xl px-4 text-sm ${detailsHref ? "" : "pointer-events-none opacity-70"}`}
        >
          Details
        </Link>
        <Link
          href={editHref ?? "#"}
          className={`app-button-secondary inline-flex h-9 items-center rounded-xl px-4 text-sm ${editHref ? "" : "pointer-events-none opacity-70"}`}
        >
          Edit
        </Link>
      </div>
    </article>
  );
}
