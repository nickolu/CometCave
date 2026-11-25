import localFont from 'next/font/local'

import type { Metadata } from 'next'
import type React from 'react'

/**
 * A family wish list, published from the Three Kids General Store. Unlisted
 * and unlinked: the id in the path is the only way in, and the cave's chrome
 * would only get in the way of a grandparent on a phone, so this page keeps
 * the shop's own fonts (the shop sets its body in Nunito, its titles in a
 * rounded display face).
 */
const fredoka = localFont({
  src: '../../fonts/fredoka-300-700-latin.woff2',
  weight: '300 700',
  variable: '--font-wish-display',
  display: 'swap',
})

const nunito = localFont({
  src: '../../fonts/nunito-200-1000-latin.woff2',
  weight: '200 1000',
  variable: '--font-wish-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wish list',
  description: 'A family wish list.',
  // The link is the key; search engines have no business here.
  robots: { index: false, follow: false },
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fredoka.variable} ${nunito.variable}`}>{children}</div>
}
