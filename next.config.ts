import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // TODO: Remove once all TypeScript strict-mode errors are resolved.
  // See issue #2719 for tracking.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/daily-card-game',
        destination: '/comet-cards',
        permanent: true,
      },
      {
        source: '/daily-card-game/:path*',
        destination: '/comet-cards/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
