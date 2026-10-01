import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // ldapts usa net/tls do Node; não empacotar (login AD).
  serverExternalPackages: ["ldapts", "@node-rs/argon2"],
  // Upload de documentos via Server Action (RN-DOC-008: até 20 MB + margem do multipart).
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
