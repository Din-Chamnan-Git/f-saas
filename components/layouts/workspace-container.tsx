type WorkspaceContainerProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export default function WorkspaceContainer({
  title,
  subtitle,
  children,
  actions,
}: WorkspaceContainerProps) {
  return (
    <section className="app-panel rounded-[28px] p-6 md:p-8 lg:min-h-[calc(100vh-4rem)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl text-[var(--app-text)]">{title}</h1>
          <p className="app-text-soft mt-2 text-sm">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
