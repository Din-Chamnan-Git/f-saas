"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to request password reset.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell-bg min-h-screen p-6 text-[#f2f5fa] md:p-10">
      <section className="app-panel mx-auto max-w-xl rounded-3xl p-8">
        <h1 className="text-3xl text-[var(--app-text)]">Forgot Password</h1>
        <p className="app-text-soft mt-4">
          Enter your account email and we will send you password reset instructions.
        </p>

        {done ? (
          <div className="app-card mt-8 rounded-2xl p-5 text-sm text-[var(--app-text)]">
            If the email exists, reset instructions have been sent. In local development, check backend logs for the
            generated reset token.
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="app-text-soft block text-sm">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="app-input mt-3 h-12 w-full rounded-xl px-4 text-sm outline-none transition focus:border-[#9ec4ff]"
              />
            </label>

            {error ? <p className="text-sm text-[#ff9b7a]">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="app-button-primary h-12 w-full rounded-xl text-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : "Send reset instructions"}
            </button>
          </form>
        )}

        <p className="app-text-soft mt-6 text-sm">
          Remembered your password?{" "}
          <Link href="/login" className="text-[#9ec4ff] hover:text-[#c4dcff]">
            Back to login
          </Link>
        </p>
      </section>
    </main>
  );
}
