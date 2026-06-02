import Link from "next/link";
import type { SidebarProps } from "@/types/sidebar";

const defaultHrefByItem: Record<string, string | undefined> = {
  Dashboard: "/dashboard",
  Owners: "/owners",
  Tenants: "/tenants",
  Servers: "/servers",
  "Onboarding Jobs": "/jobs",
  Metrics: "/metrics",
  Alerts: "/alerts",
  Logs: "/logs",
};

const navItemMeta: Record<string, { icon: string; category: "overview" | "operations" }> = {
  Dashboard: { icon: "D", category: "overview" },
  Owners: { icon: "O", category: "operations" },
  Tenants: { icon: "T", category: "operations" },
  Servers: { icon: "S", category: "operations" },
  "Onboarding Jobs": { icon: "J", category: "operations" },
  Metrics: { icon: "M", category: "overview" },
  Alerts: { icon: "A", category: "overview" },
  Logs: { icon: "L", category: "overview" },
  Profile: { icon: "P", category: "operations" },
};

export default function Sidebar({ navItems, activeItem, tenant, sectionLabel, hrefByItem }: SidebarProps) {
  const detailLines = tenant.detailLines ?? [`${tenant.serversCount} servers`, `${tenant.onboardingRunning} onboarding running`];
  const navHrefByItem = {
    ...defaultHrefByItem,
    ...(hrefByItem ?? {}),
  };
  const isAdminConsole = sectionLabel === "ADMIN CONSOLE";
  const profileIsActive = activeItem === "Profile";
  const hasAccountAvatar = Boolean(tenant.avatarText);
  const availableItems = new Set(navItems);

  if (isAdminConsole) {
    availableItems.add("Owners");
  }

  const sections = isAdminConsole
    ? [
        {
          title: "EXECUTIVE",
          items: ["Dashboard"].filter((item) => availableItems.has(item)),
        },
        {
          title: "DIRECTORY",
          items: ["Tenants", "Owners", "Servers"].filter((item) => availableItems.has(item)),
        },
        {
          title: "DELIVERY",
          items: ["Onboarding Jobs"].filter((item) => availableItems.has(item)),
        },
        {
          title: "OBSERVABILITY",
          items: ["Metrics", "Alerts", "Logs"].filter((item) => availableItems.has(item)),
        },
      ].filter((section) => section.items.length > 0)
    : [
        {
          title: "OBSERVE",
          items: navItems.filter((item) => navItemMeta[item]?.category === "overview"),
        },
        {
          title: "OPERATE",
          items: navItems.filter((item) => navItemMeta[item]?.category !== "overview"),
        },
      ].filter((section) => section.items.length > 0);

  const displayLabelByItem: Record<string, string> = isAdminConsole
    ? {
        Dashboard: "Overview",
        Owners: "Owners",
        Tenants: "Tenants",
        Servers: "Server Fleet",
        "Onboarding Jobs": "Jobs",
        Metrics: "Metrics",
        Alerts: "Alerts",
        Logs: "Logs",
        Profile: "Profile",
      }
    : {};

  const compactDetailLines = detailLines.slice(0, 2);

  return (
    <aside className="flex flex-col overflow-x-hidden rounded-3xl border border-[#222d3d] bg-[linear-gradient(180deg,#10161f_0%,#0b1118_100%)] p-5 shadow-[0_24px_80px_rgba(2,6,14,0.45)] lg:sticky lg:top-6 lg:self-start lg:p-5">
      <div className="flex items-center gap-3 border-b border-[#1d2633] pb-5">
        <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#ffb37a_0%,#fc7342_42%,#8a3516_100%)] text-sm font-semibold text-[#fff3ed] shadow-[0_14px_30px_rgba(252,115,66,0.35)]">
          M
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-[#10161f] bg-[#ff935d]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#fc7342]">MONITORING</p>
          <p className="truncate text-lg text-[#f2f5fa]">Monitor SaaS</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11px] tracking-[0.22em] text-[#6f819c]">{sectionLabel ?? "OPERATIONS"}</p>
        <span className="rounded-full border border-[#283243] bg-[#141b24] px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] text-[#9ec4ff]">
          LIVE
        </span>
      </div>

      <div className="mt-3 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[10px] font-medium tracking-[0.24em] text-[#55657e]">{section.title}</p>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const isActive = item === activeItem;
                const meta = navItemMeta[item];

                return (
                  <Link
                    key={item}
                    href={navHrefByItem[item] ?? "#"}
                    className={`group flex h-11 w-full items-center gap-3 rounded-2xl border px-3.5 text-left text-sm transition ${
                      isActive
                        ? "border-[#2d445f] bg-[linear-gradient(90deg,rgba(252,115,66,0.16)_0%,rgba(28,37,49,0.9)_42%,rgba(17,24,35,1)_100%)] text-[#f2f5fa] shadow-[inset_3px_0_0_0_#fc7342]"
                        : "border-transparent bg-transparent text-[#d4deed] hover:border-[#1f2a39] hover:bg-[#141b24]"
                    } ${navHrefByItem[item] ? "" : "pointer-events-none opacity-60"}`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[11px] font-semibold tracking-[0.08em] ${
                        isActive
                          ? "border-[#a14f2e] bg-[#3a241c] text-[#ffb38f]"
                          : "border-[#273142] bg-[#121922] text-[#87a5d4] group-hover:border-[#31425b]"
                      }`}
                    >
                      {meta?.icon ?? item.slice(0, 1)}
                    </span>
                    <span className="flex-1 truncate">{displayLabelByItem[item] ?? item}</span>
                    <span className={`text-xs ${isActive ? "text-[#fc7342]" : "text-[#5c6d86] group-hover:text-[#9ec4ff]"}`}>›</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Link
          href="/profile"
          className={`flex h-11 w-full items-center gap-3 rounded-2xl border px-3.5 text-left text-sm transition ${
            profileIsActive
              ? "border-[#2d445f] bg-[linear-gradient(90deg,rgba(252,115,66,0.16)_0%,rgba(28,37,49,0.9)_42%,rgba(17,24,35,1)_100%)] text-[#f2f5fa] shadow-[inset_3px_0_0_0_#fc7342]"
              : "border-transparent bg-transparent text-[#d4deed] hover:border-[#1f2a39] hover:bg-[#141b24]"
          }`}
        >
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[11px] font-semibold tracking-[0.08em] ${
              profileIsActive
                ? "border-[#a14f2e] bg-[#3a241c] text-[#ffb38f]"
                : "border-[#273142] bg-[#121922] text-[#87a5d4]"
            }`}
          >
            P
          </span>
          Profile
        </Link>

        {!isAdminConsole ? (
          <div className="mt-3 rounded-[22px] border border-[#293649] bg-[linear-gradient(180deg,#18212d_0%,#101823_100%)] p-3.5 shadow-[0_18px_45px_rgba(3,8,16,0.28)]">
            <div className="flex items-start justify-between gap-2.5">
              <p className="pr-2 text-[10px] leading-[14px] tracking-[0.2em] text-[#7f90aa]">{tenant.label ?? "Active Tenant"}</p>
              {tenant.badgeText ? (
                <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-[#36506f] bg-[#162334] px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-[#b9d9ff]">
                  {tenant.badgeText}
                </span>
              ) : null}
            </div>

            <div className={`mt-3 ${hasAccountAvatar ? "flex items-start gap-3" : ""}`}>
              {hasAccountAvatar ? (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,#ff935d_0%,#fc7342_100%)] text-sm font-semibold uppercase text-[#f2f5fa] shadow-[0_10px_24px_rgba(252,115,66,0.28)]">
                  {tenant.avatarText}
                </span>
              ) : null}

              <div className="min-w-0">
                <p
                  className={`break-words font-medium text-[#f2f5fa] ${
                    hasAccountAvatar ? "text-[20px] leading-[24px]" : "text-[34px] leading-[38px] md:text-[22px] md:leading-[25px]"
                  }`}
                >
                  {tenant.name}
                </p>
              </div>
            </div>

            {compactDetailLines.length > 0 ? (
              <div className="mt-3 border-t border-[#233041] pt-3">
                {compactDetailLines.map((line, index) => (
                  <p
                    key={line}
                    className={index === 0 ? "text-sm leading-[18px] text-[#d8e1ef]" : "mt-1 text-[13px] leading-[17px] text-[#8c9eba]"}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
