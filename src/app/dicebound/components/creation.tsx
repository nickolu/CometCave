'use client'

/**
 * Two questions, then you are playing.
 *
 * Both fields are on one screen rather than in a wizard, because this is the
 * only thing standing between arriving and playing and every extra step is a
 * place to leave. The suggestions are one tap and fill the field for real —
 * they exist so a player who cannot think of anything is never stuck staring
 * at a blank box, which is the actual failure mode of a game that opens with
 * "invent a world."
 *
 * Nothing here asks for an account. The campaign is saved against an anonymous
 * uid the moment it exists (CLAUDE.md principle 1).
 */
import { useState } from 'react'

import { MAX_CONCEPT, MAX_PREMISE } from '@/app/dicebound/domain/campaign'
import { ChunkyButton } from '@/components/ui/chunky-button'

const PREMISES = [
  'a heist in a clockwork city',
  'a haunted lighthouse',
  'pirates, but everyone is a cat',
  'the last library on a dying moon',
  'a village where nobody remembers yesterday',
]

const CONCEPTS = [
  'a nervous apprentice locksmith who talks too much',
  'a retired knight with bad knees and a good dog',
  'a cheerful swamp witch who is definitely lying',
  'a very small person with a very large hammer',
]

export function Creation({
  onBegin,
  pending,
  error,
}: {
  onBegin: (premise: string, concept: string) => void
  pending: boolean
  error: string | null
}) {
  const [premise, setPremise] = useState('')
  const [concept, setConcept] = useState('')

  const ready = premise.trim().length > 1 && concept.trim().length > 1

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-12">
      <header className="text-center">
        <h1 className="font-headline text-headline-lg text-on-surface">Dicebound</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">
          Say what you attempt. The dice decide the rest.
        </p>
      </header>

      <Field
        id="dicebound-premise"
        label="Where does your story begin?"
        value={premise}
        onChange={setPremise}
        maxLength={MAX_PREMISE}
        placeholder="a heist in a clockwork city"
        suggestions={PREMISES}
        disabled={pending}
      />

      <Field
        id="dicebound-concept"
        label="Who are you?"
        hint="One sentence. Your flaws count as much as your talents — they become numbers too."
        value={concept}
        onChange={setConcept}
        maxLength={MAX_CONCEPT}
        placeholder="a nervous apprentice locksmith who talks too much"
        suggestions={CONCEPTS}
        disabled={pending}
      />

      {error && (
        <p role="alert" className="text-center text-body-md text-ds-error">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <ChunkyButton
          variant="primary"
          size="hero"
          disabled={!ready || pending}
          onClick={() => onBegin(premise, concept)}
        >
          {pending ? 'Rolling up…' : 'Begin the story'}
        </ChunkyButton>
        <p className="text-sm text-on-surface-variant">
          No account needed. The cave keeps your story either way.
        </p>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength,
  placeholder,
  suggestions,
  disabled,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder: string
  suggestions: readonly string[]
  disabled: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <label htmlFor={id} className="font-headline text-xl font-extrabold text-on-surface">
        {label}
      </label>
      {hint && <p className="-mt-2 text-sm text-on-surface-variant">{hint}</p>}
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-ds-sm border-2 border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant/50 focus:border-ds-primary focus:outline-none disabled:opacity-50"
      />
      <ul className="flex flex-wrap gap-2">
        {suggestions.map(suggestion => (
          <li key={suggestion}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(suggestion)}
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:border-ds-primary/60 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary disabled:opacity-50"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
