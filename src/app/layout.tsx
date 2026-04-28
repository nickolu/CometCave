import { Plus_Jakarta_Sans, Be_Vietnam_Pro, Lexend } from 'next/font/google'
import Link from 'next/link'

import { Footer } from '@/components/footer'
import { StarField } from '@/components/star-field'

import './globals.css'
import { Providers } from './providers'
import { ROUTE_CONSTANTS } from './route-constants'

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
          <div id="site-wrapper" className="min-h-screen flex flex-col bg-space-black text-cream-white relative overflow-hidden">
            <StarField />
            <header className="p-4 z-10 relative">
              <div className="container mx-auto flex justify-between items-center flex-col md:flex-row">
                <div>
                  <Link
                    href="/"
                    className="text-2xl font-bold text-cream-white hover:text-cream-white/90 transition-colors"
                  >
                    COMETCAVE<span className="text-slate-400">.COM</span>
                  </Link>
                </div>
                <nav className="flex gap-6 w-full justify-end md:justify-end gap-y-0 mt-1 md:mt-0 flex-wrap">
                  <Link
                    href={ROUTE_CONSTANTS.HOME}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    HOME
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.ORACLE}
                    className="text-space-purple hover:text-space-purple/80 transition-colors font-semibold"
                  >
                    I-CHING ORACLE
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.RING_TOSS}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    RING TOSS
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.TAP_TAP_ADVENTURE}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    TAP TAP ADVENTURE
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.CHAT_ROOM}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    CHAT ROOM
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.TRIVIA}
                    className="text-space-gold hover:text-space-gold/80 transition-colors font-semibold"
                  >
                    DAILY TRIVIA
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.SECRET_WORD}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    SECRET WORD
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.VOTERS}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    VOTERS
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1 container mx-auto p-4 z-10 relative">{children}</main>
            <Footer />
          </div>
        </body>
      </html>
    </Providers>
  )
}
