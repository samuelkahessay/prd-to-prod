import type { NextConfig } from "next";

// This archived site is shown inside the archive frame on skahessay.dev.
// Only that origin may embed it; localhost is allowed in dev to test the frame.
const frameAncestors =
  process.env.NODE_ENV === "production"
    ? "frame-ancestors 'self' https://skahessay.dev"
    : "frame-ancestors 'self' https://skahessay.dev http://localhost:*";

// These flows drove the hosted beta, whose backend is retired.
const retiredFlows = ["build", "console", "demo"];

const config: NextConfig = {
  async redirects() {
    return retiredFlows.flatMap((flow) => [
      { source: `/${flow}`, destination: "/", permanent: false },
      { source: `/${flow}/:path*`, destination: "/", permanent: false },
    ]);
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: frameAncestors },
          // Archived site: keep out of search indexes
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default config;
