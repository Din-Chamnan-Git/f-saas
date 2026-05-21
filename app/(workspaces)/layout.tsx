export default function WorkspacesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen app-shell-bg">{children}</div>;
}
