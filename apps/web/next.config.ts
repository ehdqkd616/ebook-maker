import type { NextConfig } from "next";

// HSTS·Server 헤더 제거는 Caddy가, 앱 고유 정책은 여기서 (AI-TTS와 같은 분담)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@ebook/schema", "@ebook/layouts", "@ebook/renderer", "@ebook/db"],
  serverExternalPackages: ["nodemailer"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // 플립북 임베드(SPEC 10, /embed/*)만 다른 사이트의 iframe 허용
      { source: "/((?!embed/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
