import localFont from 'next/font/local'

import { AmbientOrbs } from '@/components/ambient-orbs'
import { Footer } from '@/components/footer'
import { LayoutShell } from '@/components/layout-shell'
import { TopNavBar } from '@/components/top-nav-bar'

import './globals.css'
import { Providers } from './providers'

import type { Metadata } from 'next'
import type React from 'react'

// Self-hosted so the build never asks Google for a stylesheet. See src/app/fonts/README.md.
const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans-200-800-latin.woff2',
  weight: '200 800',
  variable: '--font-headline',
  display: 'swap',
})

const beVietnamPro = localFont({
  src: [
    { path: './fonts/be-vietnam-pro-400-latin.woff2', weight: '400' },
    { path: './fonts/be-vietnam-pro-500-latin.woff2', weight: '500' },
    { path: './fonts/be-vietnam-pro-700-latin.woff2', weight: '700' },
  ],
  variable: '--font-body',
  display: 'swap',
})

const lexend = localFont({
  src: './fonts/lexend-100-900-latin.woff2',
  weight: '100 900',
  variable: '--font-label',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CometCave',
  description: 'A collection of browser games.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <Providers>
      <html lang="en">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className={`${plusJakartaSans.variable} ${beVietnamPro.variable} ${lexend.variable} ${beVietnamPro.className}`}>
          <div id="site-wrapper" className="min-h-dvh flex flex-col bg-surface-dim text-on-surface relative overflow-x-clip">
            <AmbientOrbs palette={['primary', 'secondary', 'tertiary']} intensity="medium" />
            <LayoutShell nav={<TopNavBar />} footer={<Footer />}>
              {children}
            </LayoutShell>
          </div>
        </body>
      </html>
    </Providers>
  )
}
