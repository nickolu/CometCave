'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { TOPIC_MAX_CHARS, cleanTopic, pickTopics } from '@/lib/blanks/story'

const IDEAS_SHOWN = 6

export function TopicPicker({
  initialTopic,
  error,
  onStart,
}: {
  initialTopic: string
  error: string | null
  onStart: (topic: string) => void
}) {
  const [topic, setTopic] = useState(initialTopic)
  const [ideas, setIdeas] = useState(() => pickTopics(IDEAS_SHOWN))
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cleaned = cleanTopic(topic)
    if (!cleaned) return
    onStart(cleaned)
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="blanks-topic-heading">
      <h2
        id="blanks-topic-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-headline text-xl font-bold text-on-surface outline-none"
      >
        What should the story be about?
      </h2>

      {error && (
        <p role="alert" className="blanks-error">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="blanks-topic" className="sr-only">
          Your topic
        </label>
        <input
          id="blanks-topic"
          className="blanks-topic-input"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Write your own topic…"
          maxLength={TOPIC_MAX_CHARS}
          autoComplete="off"
          enterKeyHint="go"
        />
        <ChunkyButton type="submit" variant="primary" size="lg" disabled={!cleanTopic(topic)}>
          Write it
        </ChunkyButton>
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">Or pick one of these:</p>
          <button
            type="button"
            className="blanks-link"
            onClick={() => setIdeas(pickTopics(IDEAS_SHOWN))}
          >
            More ideas
          </button>
        </div>
        <ul className="blanks-chips" aria-label="Topic ideas">
          {ideas.map(idea => (
            <li key={idea}>
              <button type="button" className="blanks-chip" onClick={() => onStart(idea)}>
                {idea}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center">
        <ChunkyButton type="button" variant="utility" size="md" onClick={() => onStart('')}>
          Surprise me
        </ChunkyButton>
      </div>
    </section>
  )
}
