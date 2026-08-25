import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    "trails-picnic-mailman-annex.trycloudflare.com",
  ],
};

export default nextConfig;