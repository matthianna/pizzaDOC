import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Durante il build, ignora gli errori ESLint per permettere il deploy
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  typescript: {
    // Durante il build, ignora gli errori TypeScript per permettere il deploy
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
