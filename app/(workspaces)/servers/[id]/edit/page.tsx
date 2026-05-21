import { Suspense } from "react";
import EditServerPageClient from "./edit-server-page-client";

function EditServerFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-6xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Edit Server</h1>
        <p className="app-text-soft mt-4">Loading edit form...</p>
      </section>
    </main>
  );
}

export default function EditServerPage() {
  return (
    <Suspense fallback={<EditServerFallback />}>
      <EditServerPageClient />
    </Suspense>
  );
}
