/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// CSP — tightened for production. In dev, Next requires unsafe-eval for HMR
// and inline styles for fast refresh. We keep both off in production.
const csp = [
  "default-src 'self'",
  // Next + R3F + Konva need 'unsafe-inline' for inlined chunks; eval only in dev
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://aistudio.google.com",
  // LLM + AI endpoints we explicitly call from the server (these don't need
  // browser connect-src) and a few CDN font hosts the browser does need.
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Reporting (configure REPORT_URI when you wire up a reporter like report-uri.com)
  process.env.CSP_REPORT_URI ? `report-uri ${process.env.CSP_REPORT_URI}` : "",
].filter(Boolean).join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options",     value: "nosniff" },
  { key: "X-Frame-Options",            value: "DENY" },
  { key: "X-DNS-Prefetch-Control",     value: "on" },
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS — production only (don't pin localhost). 2-year, includeSubDomains, preload-eligible
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  { key: "Content-Security-Policy",    value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig = {
  poweredByHeader: false, // remove the X-Powered-By: Next.js header
  reactStrictMode: true,
  async headers() {
    return [
      // Default — cover everything
      { source: "/:path*", headers: securityHeaders },
      // API routes get an extra Cache-Control to prevent caching of dynamic responses
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma",        value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
