import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["logging-middleware"],
};

export default nextConfig;
