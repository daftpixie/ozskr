import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // Externalize agent-wallet-sdk and its Solana deps from the bundle.
  // @solana-program/token requires a newer @solana/kit export (sequentialInstructionPlan)
  // that conflicts with the version resolved in the main app. These packages are only
  // used server-side in API routes, so Node.js resolution works correctly at runtime.
  serverExternalPackages: [
    '@ozskr/agent-wallet-sdk',
    '@solana-program/token',
    '@solana/kit',
  ],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fal.media',
      },
      {
        protocol: 'https',
        hostname: '*.fal.media',
      },
    ],
  },
};

// Bundle analyzer wrapper (run with ANALYZE=true pnpm build)
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default bundleAnalyzer(nextConfig);
