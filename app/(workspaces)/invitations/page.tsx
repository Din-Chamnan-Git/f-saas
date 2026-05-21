import { Suspense } from "react";
import InvitationsPageClient from "./invitations-page-client";

function InvitationsFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-5xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Owner Invitations</h1>
        <p className="app-text-soft mt-4">Loading invitations...</p>
      </section>
    </main>
  );
}

export default function InvitationsPage() {
  return (
    <Suspense fallback={<InvitationsFallback />}>
      <InvitationsPageClient />
    </Suspense>
  );
}
