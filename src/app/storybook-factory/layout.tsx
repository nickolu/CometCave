import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Storybook Factory - CometCave',
  description:
    'Generate illustrated comic books and storybooks from your pictures! Upload your images, choose a story style, and watch AI craft a unique illustrated story just for you.',
  keywords: [
    'storybook',
    'comic book',
    'illustrated stories',
    'AI story generator',
    'photo storybook',
    'image to story',
  ],
  authors: [{ name: 'CometCave' }],
  openGraph: {
    title: 'Storybook Factory - CometCave',
    description:
      'Generate illustrated comic books and storybooks from your pictures! Upload images and watch AI craft a unique illustrated story.',
    url: 'https://cometcave.com/storybook-factory',
    siteName: 'CometCave - AI Galaxy Arcade',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Storybook Factory - CometCave',
    description:
      'Generate illustrated comic books and storybooks from your pictures!',
    creator: '@cometcave',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://cometcave.com/storybook-factory',
  },
}

export default function StorybookFactoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
