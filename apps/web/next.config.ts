import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";


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

const withNextIntl = createNextIntlPlugin();


export default withNextIntl(nextConfig);

