import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/substitutions",
        destination: "/substitution-requests",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  eslint: {
    // Legacy codebase has widespread `any` / unescaped entities; enable after lint cleanup.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep true until legacy TS debt is cleaned up (hours-summary, uuid types, etc.).
    // Security-critical paths (prisma.user, cron auth) are fixed; do not reintroduce ignore for those.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
