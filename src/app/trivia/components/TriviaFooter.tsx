'use client'

export type TriviaFooterTarget =
  | 'home'
  | 'stats'
  | 'leaderboard'
  | 'infinite-stats'
  | 'infinite-leaderboard'
  | 'library'
  | 'calendar'

export interface TriviaNav {
  onHome?: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
  onViewInfiniteStats?: () => void
  onViewInfiniteLeaderboard?: () => void
  onLibrary?: () => void
  onCalendar?: () => void
}

interface TriviaFooterProps extends TriviaNav {
  // The view that's currently rendering this footer. Used to suppress
  // the link that points back to itself, so the footer is consistent
  // across screens but doesn't offer a no-op tap.
  current?: TriviaFooterTarget
}

export function TriviaFooter({
  onHome,
  onViewStats,
  onViewLeaderboard,
  onViewInfiniteStats,
  onViewInfiniteLeaderboard,
  onLibrary,
  onCalendar,
  current,
}: TriviaFooterProps) {
  const links: { key: TriviaFooterTarget; label: string; onClick?: () => void }[] = [
    { key: 'home', label: 'Home', onClick: onHome },
    { key: 'stats', label: 'My Stats', onClick: onViewStats },
    { key: 'leaderboard', label: 'Leaderboard', onClick: onViewLeaderboard },
    { key: 'infinite-stats', label: 'Infinite Stats', onClick: onViewInfiniteStats },
    { key: 'infinite-leaderboard', label: 'Infinite Ranks', onClick: onViewInfiniteLeaderboard },
    { key: 'library', label: 'Question Library', onClick: onLibrary },
    { key: 'calendar', label: 'Calendar', onClick: onCalendar },
  ]
  const visible = links.filter((l) => l.onClick && l.key !== current)

  return (
    <nav
      aria-label="Trivia navigation"
      className="w-full flex gap-3 text-sm flex-wrap justify-center pt-4 mt-2 border-t border-outline-variant/20"
    >
      {visible.map((link, i) => (
        <span key={link.key} className="contents">
          {i > 0 && <span aria-hidden="true" className="text-on-surface/20">·</span>}
          <button
            type="button"
            onClick={link.onClick}
            className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors underline-offset-4 hover:underline"
          >
            {link.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
