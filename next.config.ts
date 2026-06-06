import type { NextConfig } from "next";

function resolveApiOrigin(): string {
  const fallback = "http://localhost:8080";
  const rawValue = process.env.NEXT_PUBLIC_API_BASE_URL ?? fallback;

  try {
    return new URL(rawValue).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

function buildContentSecurityPolicy(): string {
  const apiOrigin = resolveApiOrigin();

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${apiOrigin}`,
    "script-src 'self' 'unsafe-inline'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/workspace",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/invitations",
        destination: "/owners",
        permanent: false,
      },
      {
        source: "/tasks",
        destination: "/jobs",
        permanent: false,
      },
      {
        source: "/tasks/:id",
        destination: "/jobs/:id",
        permanent: false,
      },
    ];
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    const contentSecurityPolicy = buildContentSecurityPolicy();

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
