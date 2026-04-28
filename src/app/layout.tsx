import { Plus_Jakarta_Sans, Be_Vietnam_Pro, Lexend } from 'next/font/google'

import { Footer } from '@/components/footer'
import { StarField } from '@/components/star-field'
import { TopNavBar } from '@/components/top-nav-bar'

import './globals.css'
import { Providers } from './providers'

import type { Metadata } from 'next'
import type React from 'react'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '800'],
  variable: '--font-headline',
  display: 'swap',
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
})

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-label',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CometCave - AI Galaxy Arcade',
  description: 'Fun games for space hermits',
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
        </head>
        <body className={`${plusJakartaSans.variable} ${beVietnamPro.variable} ${lexend.variable} ${beVietnamPro.className}`}>
          <div id="site-wrapper" className="min-h-screen flex flex-col bg-surface-dim text-on-surface relative overflow-hidden">
            <StarField />
            <TopNavBar />
            <main className="flex-1 container mx-auto p-4 z-10 relative">{children}</main>
            <Footer />
          </div>
        </body>
      </html>
    </Providers>
  )
}
