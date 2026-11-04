import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@hub/capture"],
  async rewrites() {
    // /r/<slug>.md is a file-style URL for agents; the app serves it from a route handler.
    return { beforeFiles: [{ source: "/r/:slug.md", destination: "/api/card-md/:slug" }], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default config;
