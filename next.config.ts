import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function origin(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

const supabaseOrigin = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const modelsOrigin = origin(process.env.NEXT_PUBLIC_MODELS_BASE_URL);

// Realtime uses a websocket on the same host as the REST API.
const supabaseWs = supabaseOrigin?.replace(/^http/, "ws") ?? null;

const csp = [
  "default-src 'self'",
  // Next.js inlines bootstrap scripts, so 'unsafe-inline' stays until a
  // nonce-based CSP is wired through the proxy. 'wasm-unsafe-eval' is needed
  // by onnxruntime-web and MediaPipe; 'unsafe-eval' only for dev (React
  // refresh).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blob:/data: for the camera snapshot and client photos; signed photo
  // URLs come from Supabase Storage.
  ["img-src 'self' data: blob:", supabaseOrigin].filter(Boolean).join(" "),
  "font-src 'self' data:",
  ["connect-src 'self' blob:", supabaseOrigin, supabaseWs, modelsOrigin]
    .filter(Boolean)
    .join(" "),
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The kiosk and face enrollment need the camera, nothing else is used.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The face-recognition model (~260 MB) and the WASM runtimes are static
      // and versioned by file; let the browser keep them between visits so
      // only the first activation of the camera pays the download.
      ...["/models/:path*", "/ort/:path*", "/mediapipe/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      })),
    ];
  },
  // The floating dev indicator badge intermittently throws
  // "NotFoundError: releasePointerCapture" from inside Next's own devtools
  // bundle, and it visually overlaps mobile Sheet/Dialog footers. Dev-only,
  // no effect on production builds.
  devIndicators: false,
};

export default nextConfig;
