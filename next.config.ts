import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
