import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Anchor the turbopack root to this project (avoids OneDrive path
  // confusion in git-root detection).
  turbopack: {
    root: path.join(__dirname),
  },
}

export default nextConfig
