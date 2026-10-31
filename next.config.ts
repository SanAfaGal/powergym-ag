import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The face-recognition model (~260 MB) and the WASM runtimes are static and
  // versioned by file; let the browser keep them between visits so only the
  // first activation of the camera pays the download.
  async headers() {
    return [
      "/models/:path*",
      "/ort/:path*",
      "/mediapipe/:path*",
    ].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=604800" },
      ],
    }));
  },
  // The floating dev indicator badge intermittently throws
  // "NotFoundError: releasePointerCapture" from inside Next's own devtools
  // bundle, and it visually overlaps mobile Sheet/Dialog footers. Dev-only,
  // no effect on production builds.
  devIndicators: false,
};

export default nextConfig;
