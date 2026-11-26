import type { NextConfig } from "next";
import { baselineSecurityHeaders } from "./src/security-headers";

const securityHeaders = baselineSecurityHeaders(process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["bcryptjs", "qrcode"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
