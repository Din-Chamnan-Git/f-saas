"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { resetPassword } from "@/services/authService";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing or invalid.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to reset password.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Reset Password</h1>
        <p className="app-text-soft mt-4">Set a new password for your account.</p>

        {done ? (
          <div className="app-card mt-8 rounded-2xl p-5 text-sm text-[var(--app-text)]">
            Password has been reset successfully.
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="app-text-soft block text-sm">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                className="app-input mt-3 h-12 w-full rounded-xl px-4 text-sm outline-none transition focus:border-[#9ec4ff]"
              />
            </label>

            <label className="app-text-soft block text-sm">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                className="app-input mt-3 h-12 w-full rounded-xl px-4 text-sm outline-none transition focus:border-[#9ec4ff]"
              />
            </label>

            {error ? <p className="text-sm text-[#ff9b7a]">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="app-button-primary h-12 w-full rounded-xl text-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        <p className="app-text-soft mt-6 text-sm">
          <Link href="/login" className="text-[#9ec4ff] hover:text-[#c4dcff]">
            Back to login
          </Link>
        </p>
      </section>
    </main>
  );
}
