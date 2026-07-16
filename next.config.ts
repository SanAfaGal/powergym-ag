import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev indicator badge intermittently throws
  // "NotFoundError: releasePointerCapture" from inside Next's own devtools
  // bundle, and it visually overlaps mobile Sheet/Dialog footers. Dev-only,
  // no effect on production builds.
  devIndicators: false,
};

export default nextConfig;
