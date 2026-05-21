export type SidebarTenant = {
  label?: string;
  name: string;
  serversCount: number;
  onboardingRunning: number;
  detailLines?: string[];
  badgeText?: string;
  avatarText?: string;
};

export type SidebarProps = {
  navItems: string[];
  activeItem: string;
  tenant: SidebarTenant;
  sectionLabel?: string;
  hrefByItem?: Partial<Record<string, string>>;
};
