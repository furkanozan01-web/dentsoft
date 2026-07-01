import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The always-on PM2 instance runs `next dev` while production builds may be
  // created from the same checkout. Keep their generated files separate so a
  // build cannot invalidate the running development server's manifests.
  distDir:
    process.env.NODE_ENV === "development"
      ? `.next-dev-${process.env.PORT ?? "3000"}`
      : ".next",
};

export default nextConfig;
