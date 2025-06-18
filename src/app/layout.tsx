import type React from 'react';
import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { StarField } from '@/components/star-field';
import { Footer } from '@/components/footer';
import { ROUTE_CONSTANTS } from './route-constants';
import { Providers } from './providers';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CometCave - Kid-Friendly Games',
  description: 'Free games that are safe for kids and ad-free',
  generator: 'v0.dev',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <html lang="en">
        <body className={spaceGrotesk.className}>
          <div className="min-h-screen flex flex-col bg-space-black text-cream-white relative overflow-hidden">
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
                    href={ROUTE_CONSTANTS.RING_TOSS}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    RING TOSS
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.FANTASY_TYCOON}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    FANTASY TYCOON
                  </Link>
                  <Link
                    href={ROUTE_CONSTANTS.CHAT_ROOM}
                    className="text-cream-white hover:text-cream-white/80 transition-colors"
                  >
                    CHAT ROOM
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
  );
}
