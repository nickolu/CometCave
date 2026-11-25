'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { type FilledStory, encodeShared, storyText } from '@/lib/blanks/story'

export function StoryReveal({
  story,
  sharedByOther = false,
  onRefill,
  onNewTopic,
  onMakeOwn,
}: {
  story: FilledStory
  /** True when this story arrived in a link rather than being written here. */
  sharedByOther?: boolean
  onRefill?: () => void
  onNewTopic?: () => void
  onMakeOwn?: () => void
}) {
  const [status, setStatus] = useState('')
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [story])

  const flash = (message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(''), 2500)
  }

  const shareUrl = () => `${window.location.origin}/blanks#s=${encodeShared(story)}`

  const share = async () => {
    const url = shareUrl()
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: storyText(story), url })
        return
      }
      await navigator.clipboard.writeText(url)
      flash('Link copied.')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      flash('Could not copy the link.')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${storyText(story)}\n\n${shareUrl()}`)
      flash('Story copied.')
    } catch {
      flash('Could not copy the story.')
    }
  }

  let wordIndex = 0

  return (
    <section className="flex flex-col gap-5" aria-labelledby="blanks-story-title">
      <article className="blanks-paper">
        <p className="blanks-eyebrow">
          {sharedByOther ? 'A story someone filled in' : 'Your story'}
        </p>
        <h2
          id="blanks-story-title"
          ref={titleRef}
          tabIndex={-1}
          className="blanks-title outline-none"
        >
          {story.title}
        </h2>
        <div className="blanks-prose">
          {story.parts.map((part, i) =>
            part.kind === 'text' ? (
              <span key={i}>{part.text}</span>
            ) : (
              <mark
                key={i}
                className="blanks-word"
                style={{ '--i': wordIndex++ } as CSSProperties}
                title={part.hint}
              >
                {part.word}
              </mark>
            )
          )}
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <ChunkyButton
          type="button"
          variant="primary"
          size="lg"
          onClick={share}
          iconStart={
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              share
            </span>
          }
        >
          Share
        </ChunkyButton>
        <ChunkyButton type="button" variant="utility" size="lg" onClick={copy}>
          Copy story
        </ChunkyButton>
        {sharedByOther ? (
          <ChunkyButton type="button" variant="secondary" size="lg" onClick={onMakeOwn}>
            Make your own
          </ChunkyButton>
        ) : (
          <>
            <ChunkyButton type="button" variant="secondary" size="lg" onClick={onRefill}>
              Same story, new words
            </ChunkyButton>
            <ChunkyButton type="button" variant="ghost" size="lg" onClick={onNewTopic}>
              New topic
            </ChunkyButton>
          </>
        )}
      </div>
      <p className="min-h-5 text-center text-sm text-on-surface-variant" aria-live="polite">
        {status}
      </p>
    </section>
  )
}
