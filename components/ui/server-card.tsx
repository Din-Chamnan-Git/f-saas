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

type ServerCardProps = {
  server: ServerRow;
};

export default function ServerCard({ server }: ServerCardProps) {
  const openHref = server.id && server.tenantId ? `/metrics?tenantId=${server.tenantId}&serverId=${server.id}` : undefined;
  const verifyHref = server.id && server.tenantId ? `/jobs?tenantId=${server.tenantId}&serverId=${server.id}` : undefined;
  const editHref = server.id && server.tenantId ? `/servers/${server.id}/edit?tenantId=${server.tenantId}` : undefined;
  const primaryHref = server.primaryAction === "Verify" ? verifyHref : openHref;

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
        <Link
          href={primaryHref ?? "#"}
          className={`app-button-primary inline-flex h-9 items-center rounded-xl px-4 text-sm hover:brightness-110 ${primaryHref ? "" : "pointer-events-none opacity-70"}`}
        >
          {server.primaryAction}
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
