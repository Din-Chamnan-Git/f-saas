import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

function ResetPasswordFallback() {
  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Reset Password</h1>
        <p className="app-text-soft mt-4">Loading reset form...</p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
