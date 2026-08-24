import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'motion', 'recharts']
  },
  allowedDevOrigins: ['10.100.230.144', '192.168.1.5', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/supabase-proxy/:path*',
        destination: 'https://tcrhnpknzbahxboheznm.supabase.co/:path*',
      },
    ]
  },
};

export default nextConfig;
