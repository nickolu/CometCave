'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { SENTENCE_MAX, SENTENCE_MIN } from '@/lib/picture-telephone/settings'

import { ImageCard } from './ImageCard'

interface TurnProps {
  name: string
  /** The previous picture, or null on the opening turn. */
  image: string | null
  /** The last sentence of the chain: no picture follows it. */
  isFinal: boolean
  /** The opening turn can ask an AI for the sentence. */
  canAiStart: boolean
  notice: string | null
  onSubmit: (text: string) => Promise<void>
  onAiStarts: () => void
}

export function Turn({ name, image, isFinal, canAiStart, notice, onSubmit, onAiStarts }: TurnProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const ready = text.trim().length >= SENTENCE_MIN

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    try {
      await onSubmit(text)
    } finally {
      setBusy(false)
    }
  }

  const heading = image ? `${name}, what do you see?` : `${name}, write the opening sentence`
  const hint = image
    ? isFinal
      ? 'This is the last one. Say what it looks like to you.'
      : 'Describe the picture in a sentence. The next picture will be drawn from your words.'
    : 'Anything you can picture: a place, an animal, something happening.'

  return (
    <form className="flex flex-1 flex-col gap-4" onSubmit={submit} aria-labelledby="pt-turn-heading">
      <div>
        <h2 id="pt-turn-heading" ref={headingRef} tabIndex={-1} className="pt-heading">
          {heading}
        </h2>
        <p className="pt-sub">{hint}</p>
      </div>

      {notice && (
        <p role="alert" className="pt-notice">
          {notice}
        </p>
      )}

      {image && <ImageCard src={image} alt="The picture to describe" />}

      <div>
        <label htmlFor="pt-sentence" className="sr-only">
          Your sentence
        </label>
        <textarea
          id="pt-sentence"
          className="pt-textarea"
          value={text}
          maxLength={SENTENCE_MAX}
          placeholder={image ? 'I see…' : 'A fox in a yellow raincoat splashes through a puddle'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        <p className="pt-count" aria-hidden>
          {text.length}/{SENTENCE_MAX}
        </p>
      </div>

      <div className="pt-actions pt-actions-sticky">
        <ChunkyButton size="hero" type="submit" disabled={!ready || busy}>
          {isFinal ? 'Lock it in' : 'Draw it!'}
        </ChunkyButton>
        {canAiStart && (
          <ChunkyButton variant="secondary" size="lg" type="button" disabled={busy} onClick={onAiStarts}>
            Let an AI start
          </ChunkyButton>
        )}
      </div>
    </form>
  )
}
