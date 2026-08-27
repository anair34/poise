import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Admin SDK as a real Node dependency rather than bundling it.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
