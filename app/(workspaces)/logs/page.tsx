import { Suspense } from "react";
import LogsPageClient from "./logs-page-client";

function LogsFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-7xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Logs</h1>
        <p className="app-text-soft mt-4">Loading logs...</p>
      </section>
    </main>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<LogsFallback />}>
      <LogsPageClient />
    </Suspense>
  );
}
