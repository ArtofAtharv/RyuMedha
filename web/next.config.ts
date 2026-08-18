import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === "development"

const nextConfig: NextConfig = {
  // Turbopack root only needed locally for monorepo-style resolution
  ...(isDev && {
    turbopack: {
      root: projectRoot,
    },
  }),

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "motion", "recharts"],
  },

  // Only allow cross-origin dev origins in development
  ...(isDev && {
    allowedDevOrigins: ["10.100.230.144", "192.168.1.5", "192.168.1.14", "localhost"],
  }),
}

export default nextConfig
