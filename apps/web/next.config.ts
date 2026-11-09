import type { NextConfig } from "next";

const photoHost = process.env.S3_PUBLIC_URL
  ? new URL(process.env.S3_PUBLIC_URL)
  : null;

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: photoHost
      ? [
          {
            protocol: photoHost.protocol.replace(":", "") as "http" | "https",
            hostname: photoHost.hostname,
            port: photoHost.port,
          },
        ]
      : [],
  },
};

export default nextConfig;
