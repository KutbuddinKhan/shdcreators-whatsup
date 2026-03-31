import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep functions warmer on Hobby plan
  },
  serverExternalPackages: [],
};

export default nextConfig;
