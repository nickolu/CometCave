'use client'

import Link from 'next/link'

export type TriviaFooterTarget =
  | 'home'
  | 'stats'
  | 'leaderboard'
  | 'infinite-stats'
  | 'infinite-leaderboard'
  | 'library'
  | 'calendar'

interface TriviaFooterProps {
  // The view that's currently rendering this footer. Used to suppress
  // the link that points back to itself, so the footer is consistent
  // across screens but doesn't offer a no-op tap.
  current?: TriviaFooterTarget
}

const LINKS: { key: TriviaFooterTarget; label: string; href: string }[] = [
  { key: 'home', label: 'Home', href: '/trivia' },
  { key: 'stats', label: 'My Stats', href: '/trivia/stats' },
  { key: 'leaderboard', label: 'Leaderboard', href: '/trivia/leaderboard' },
  { key: 'infinite-stats', label: 'Infinite Stats', href: '/trivia/stats?tab=infinite' },
  { key: 'infinite-leaderboard', label: 'Infinite Ranks', href: '/trivia/leaderboard?tab=infinite' },
  { key: 'library', label: 'Question Library', href: '/trivia/library' },
  { key: 'calendar', label: 'Calendar', href: '/trivia/calendar' },
]

export function TriviaFooter({ current }: TriviaFooterProps) {
  const visible = LINKS.filter((l) => l.key !== current)

  return (
    <nav
      aria-label="Trivia navigation"
      className="w-full flex gap-3 text-sm flex-wrap justify-center pt-4 mt-2 border-t border-outline-variant/20"
    >
      {visible.map((link, i) => (
        <span key={link.key} className="contents">
          {i > 0 && <span aria-hidden="true" className="text-on-surface/20">·</span>}
          <Link
            href={link.href}
            className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}
