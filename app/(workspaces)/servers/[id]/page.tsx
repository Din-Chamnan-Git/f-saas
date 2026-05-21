import { Suspense } from "react";
import ServerPageClient from "./server-page-client";

function ServerFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-6xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Server</h1>
        <p className="app-text-soft mt-4">Loading server details...</p>
      </section>
    </main>
  );
}

export default function ServerPage() {
  return (
    <Suspense fallback={<ServerFallback />}>
      <ServerPageClient />
    </Suspense>
  );
}
