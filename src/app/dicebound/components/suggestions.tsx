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
export function Suggestions({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: readonly string[]
  onPick: (text: string) => void
  disabled: boolean
}) {
  if (suggestions.length === 0) return null

  return (
    <ul
      // Keyed on the set itself so React remounts the list when the three
      // change, which is what replays the fade. A new three arrive under a
      // player who is still reading the paragraph above them, and something
      // that appears without warning under moving eyes reads as a glitch.
      key={suggestions.join(' ')}
      aria-label="Things you might try. Choosing one fills the box; you can change it before you send."
      className="dicebound-suggestions mx-auto flex max-w-2xl flex-wrap gap-2 pb-3"
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
  )
}
