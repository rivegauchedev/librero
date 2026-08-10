import type { NextConfig } from "next";

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 100);

const nextConfig: NextConfig = {
  // Self-hosted in Docker: emit a minimal server bundle instead of needing the
  // whole node_modules tree in the runtime image.
  output: "standalone",

  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // Ebook uploads go through a Server Action, so the body limit has to clear
      // the largest file we accept.
      bodySizeLimit: `${maxUploadMb + 2}mb`,
    },
  },

  // better-sqlite3 and argon2 are native modules — they must not be bundled.
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],

  // Covers and ebooks are served from our own routes off local disk, so the
  // image optimizer is never pointed at a third-party host.
  images: { remotePatterns: [] },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
