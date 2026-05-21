import { Suspense } from "react";
import TasksPageClient from "./tasks-page-client";

function TasksFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-7xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Onboarding Jobs</h1>
        <p className="app-text-soft mt-4">Loading jobs...</p>
      </section>
    </main>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksFallback />}>
      <TasksPageClient />
    </Suspense>
  );
}
