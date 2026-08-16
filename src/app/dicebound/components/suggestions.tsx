'use client'

/**
 * Three things you might try, offered under the composer.
 *
 * They fill the field; they do not send it. That is the whole design decision
 * and it is the one thing in this file worth protecting. Dicebound is a game
 * where the player writes an attempt in their own words — the composer's
 * placeholder exists to teach that, and the DM is forbidden from ever asking
 * "what do you do?" precisely so the sentence stays theirs. A chip that sent on
 * tap would turn all of that into a three-option menu within a week, and the
 * median action would get shorter and blander with it.
 *
 * So a tap is a starting point. The text lands in the box with the caret at the
 * end of it, one keystroke away from being edited into something the player
 * actually meant. It is the same bargain the creation screen already makes with
 * its concept and premise chips.
 *
 * Nothing renders until there is something to offer (invariant 17) — but once
 * the story is under way the row stays put through a turn, greyed and
 * untappable while the dungeon master answers, so the composer under a player's
 * thumb never moves.
 */
import { useDicebound } from '@/app/dicebound/store'

export function Suggestions({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: readonly string[]
  onPick: (text: string) => void
  disabled: boolean
}) {
  const { suggestionsHidden, toggleSuggestions } = useDicebound()

  // Invariant 17: nothing renders until the story is under way.
  // The toggle itself does not appear until the first set of chips arrives.
  if (suggestions.length === 0) return null

  if (suggestionsHidden) {
    return (
      <div className="mx-auto max-w-2xl pb-3">
        <button
          type="button"
          onClick={toggleSuggestions}
          aria-expanded={false}
          className="text-sm italic text-on-surface-variant/60 hover:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          things you might try
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pb-3">
      <ul
        key={suggestions.join(' ')}
        aria-label="Things you might try. Choosing one fills the box; you can change it before you send."
        className="dicebound-suggestions flex flex-wrap gap-2"
      >
        {suggestions.map(suggestion => (
          <li key={suggestion}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(suggestion)}
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-left text-sm italic text-on-surface-variant transition-colors hover:border-ds-primary/60 hover:not-italic hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary disabled:opacity-40"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={toggleSuggestions}
        aria-expanded={true}
        className="mt-2 text-sm text-on-surface-variant/50 hover:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
      >
        put away
      </button>
    </div>
  )
}
