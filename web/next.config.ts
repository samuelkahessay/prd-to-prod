import type { NextConfig } from "next";

const config: NextConfig = {
  async rewrites() {
    const apiTarget = process.env.API_URL || "http://127.0.0.1:3000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
      {
        source: "/pub/:path*",
        destination: `${apiTarget}/pub/:path*`,
      },
    ];
  },
};

export default config;
