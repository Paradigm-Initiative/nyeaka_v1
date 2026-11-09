import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7f05a7f94fe842f8a16f407ae17416c1.r2.dev"
      }
    ]
  }
};

export default nextConfig;
