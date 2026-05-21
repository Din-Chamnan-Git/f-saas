import type { NextConfig } from "next";

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
};

export default nextConfig;
