import type { NextConfig } from "next";
const development = process.env.NODE_ENV === "development";
// Static-compatible CSP: Next's inline hydration requires unsafe-inline. No eval or remote scripts in production.
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'" + (development ? " 'unsafe-eval'" : ""), "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data: blob:", "font-src 'self'", "connect-src 'self'" + (development ? " ws: wss:" : ""), "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"] .join("; ");
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingExcludes: { "/*": ["./.runtime/**/*", "./.qa/**/*", "./.env*"] },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ...(!development ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ] },
    { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ...(process.env.VERCEL_ENV === "preview" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
  ]; },
};
export default config;
