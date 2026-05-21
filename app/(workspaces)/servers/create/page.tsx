import { Suspense } from "react";
import CreateServerPageClient from "./create-server-page-client";

function CreateServerFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-4xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Create Server</h1>
        <p className="app-text-soft mt-4">Loading server form...</p>
      </section>
    </main>
  );
}

export default function CreateServerPage() {
  return (
    <Suspense fallback={<CreateServerFallback />}>
      <CreateServerPageClient />
    </Suspense>
  );
}
