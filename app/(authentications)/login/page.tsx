"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";
import { TecheyLogo } from "@/components/branding/techey-logo";
import { apiPost } from "@/services/apiClient";
import { getCurrentUser } from "@/services/authService";

type LoginResult = {
  accessToken: string;
  refreshToken: string;
};

type LoginBody = {
  email: string;
  password: string;
  rememberDevice: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already has a valid session (or refresh flow can obtain one),
  // redirect away from the login page.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await getCurrentUser("");
        if (mounted) router.replace("/dashboard");
      } catch {
        // no-op: user is not authenticated
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiPost<LoginResult, LoginBody>("/api/v1/auth/login", { email, password, rememberDevice });

      router.push("/dashboard");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to sign in right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell-bg relative min-h-screen overflow-hidden px-4 py-8 md:px-6 md:py-12" data-node-id="40:2">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#c98a00]/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[390px] items-center justify-center">
        <section className="app-panel w-full rounded-3xl border border-[#2b3647] bg-[linear-gradient(180deg,rgba(27,35,48,0.95)_0%,rgba(21,28,40,0.96)_100%)] p-5 shadow-[0_22px_48px_rgba(4,9,18,0.45)] md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <TecheyLogo className="h-14 w-auto max-w-[220px] drop-shadow-[0_12px_22px_rgba(201,138,0,0.16)]" />
            <span className="rounded-full bg-[#c98a00]/20 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#f6df9a]">SECURE</span>
          </div>

          <h1 className="text-center text-[30px] font-semibold leading-tight text-[var(--app-text)]">Welcome back</h1>
          <p className="app-text-soft mt-1.5 text-center text-[13px]">Sign in to continue to your workspace.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="app-text-soft block text-sm">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="app-input mt-2 h-11 w-full rounded-lg px-3.5 text-sm outline-none transition focus:border-[#9ec4ff] focus:ring-2 focus:ring-[#9ec4ff]/40"
              />
            </label>

            <label className="app-text-soft block text-sm">
              <span>Password</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="app-input h-11 w-full rounded-lg px-3.5 pr-11 text-sm outline-none transition focus:border-[#9ec4ff] focus:ring-2 focus:ring-[#9ec4ff]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="app-text-soft absolute right-3 top-1/2 -translate-y-1/2 hover:text-[var(--app-text)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M3 3L21 21M10.58 10.59C10.21 10.96 10 11.47 10 12C10 13.1 10.9 14 12 14C12.53 14 13.04 13.79 13.41 13.42M9.88 5.09C10.56 4.89 11.27 4.78 12 4.78C16.2 4.78 19.79 7.26 21.24 10.78C20.56 12.44 19.38 13.84 17.87 14.79M6.1 6.11C4.15 7.33 2.66 8.92 1.76 10.78C3.22 14.3 6.8 16.78 11 16.78C12.73 16.78 14.35 16.36 15.77 15.62"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M1.76 12C3.22 8.48 6.8 6 11 6C15.2 6 18.78 8.48 20.24 12C18.78 15.52 15.2 18 11 18C6.8 18 3.22 15.52 1.76 12Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="app-text-soft inline-flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(event) => setRememberDevice(event.target.checked)}
                  className="h-4 w-4 appearance-none rounded border border-[#2b3647] bg-[#1a2230] checked:border-[#c98a00] checked:bg-[#c98a00] focus:ring-2 focus:ring-[#9ec4ff]/40 focus:outline-none"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-[13px] text-[#9ec4ff] hover:text-[#c4dcff]">
                Forgot password?
              </Link>
            </div>

            {error ? <p className="text-sm text-[#ff9b7a]">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="app-button-primary h-11 w-full rounded-lg text-sm font-medium transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </section>
      </main>
    </div>
  );
}
