'use client'

import { type FormEvent, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { type StoryTemplate, WORD_MAX_CHARS, cleanWord, hintHelp } from '@/lib/blanks/story'

export function FillBlanks({
  template,
  words,
  onWordsChange,
  onDone,
}: {
  template: StoryTemplate
  words: string[]
  onWordsChange: (words: string[]) => void
  onDone: () => void
}) {
  const total = template.hints.length
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      words.findIndex(w => !w.trim())
    )
  )
  const [draft, setDraft] = useState(words[index] ?? '')
  const hint = template.hints[index]
  const help = hintHelp(hint)
  const last = index === total - 1

  const goTo = (next: number) => {
    setIndex(next)
    setDraft(words[next] ?? '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const word = cleanWord(draft)
    if (!word) return
    const updated = words.map((w, i) => (i === index ? word : w))
    onWordsChange(updated)
    if (last) {
      const firstEmpty = updated.findIndex(w => !w.trim())
      if (firstEmpty === -1) onDone()
      else {
        setIndex(firstEmpty)
        setDraft('')
      }
    } else {
      goTo(index + 1)
    }
  }

  return (
    <section className="blanks-paper blanks-paper-sm" aria-labelledby="blanks-fill-heading">
      <div className="flex items-center justify-between gap-3">
        <p className="blanks-eyebrow" id="blanks-fill-heading">
          Blank {index + 1} of {total}
        </p>
        <ol className="blanks-dots" aria-hidden="true">
          {template.hints.map((h, i) => (
            <li
              key={i}
              className="blanks-dot"
              data-state={i === index ? 'current' : words[i]?.trim() ? 'done' : 'todo'}
            />
          ))}
        </ol>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5" key={index}>
        <div className="flex flex-col gap-1">
          <label htmlFor="blanks-word" className="blanks-hint">
            {hint}
          </label>
          {help && (
            <p id="blanks-word-help" className="blanks-ink-soft text-sm">
              {help}
            </p>
          )}
        </div>

        <input
          id="blanks-word"
          className="blanks-word-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={WORD_MAX_CHARS}
          autoComplete="off"
          autoFocus
          enterKeyHint={last ? 'done' : 'next'}
          aria-describedby={help ? 'blanks-word-help' : undefined}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChunkyButton
            type="button"
            variant="ghost"
            size="md"
            className="blanks-back"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            Back
          </ChunkyButton>
          <ChunkyButton type="submit" variant="primary" size="lg" disabled={!cleanWord(draft)}>
            {last ? 'Read the story' : 'Next'}
          </ChunkyButton>
        </div>
      </form>
    </section>
  )
}
