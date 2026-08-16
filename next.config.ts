import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `typescript.ignoreBuildErrors` used to be set here, with a TODO pointing at
  // issue #2719. It is gone, and it should stay gone.
  //
  // What it cost: `tsc` had correctly reported
  // "Block-scoped variable 'isPlant' used before its declaration" and two
  // "Cannot find name" errors in the micro-land simulation. All three were
  // guaranteed runtime ReferenceErrors, all three built cleanly because of this
  // flag, and all three shipped — freezing /micro-land for every visitor the
  // moment their world grew its first plant. The compiler had the answer the
  // whole time and was told not to interrupt.
  //
  // The backlog it was covering for is cleared. `npm run typecheck` is clean;
  // a new type error now fails the build instead of becoming a bug report.
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
