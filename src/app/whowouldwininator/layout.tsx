import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Amazing Whowouldwininator - CometCave',
  description:
    'Create epic battles between any two characters! Generate detailed character profiles, define battle scenarios, and watch AI-powered contests unfold with stunning results.',
  keywords: [
    'character battles',
    'AI game',
    'fantasy battles',
    'character generator',
    'contest simulator',
    'whowouldwin',
  ],
  authors: [{ name: 'CometCave' }],
  openGraph: {
    title: 'The Amazing Whowouldwininator - Epic Character Battles',
    description:
      'Create epic battles between any two characters! Generate detailed character profiles, define battle scenarios, and watch AI-powered contests unfold.',
    url: 'https://cometcave.com/whowouldwininator',
    siteName: 'CometCave - AI Galaxy Arcade',
    type: 'website',
    images: [
      {
        url: '/whowouldwininator-preview.png',
        width: 1200,
        height: 630,
        alt: 'The Amazing Whowouldwininator - Epic Character Battles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Amazing Whowouldwininator - Epic Character Battles',
    description:
      'Create epic battles between any two characters! Generate detailed profiles and watch AI-powered contests unfold.',
    images: ['/placeholder-logo.png'],
    creator: '@cometcave',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://cometcave.com/whowouldwininator',
  },
};

export default function WhowouldwininatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
