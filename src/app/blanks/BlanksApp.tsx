'use client'

import { useState, useSyncExternalStore } from 'react'

import { AiGate } from '@/components/ai-gate'
import { aiErrorMessage, aiFetch } from '@/lib/api/ai-fetch'
import {
  type FilledStory,
  type StoryTemplate,
  fillTemplate,
  sharedFromHash,
} from '@/lib/blanks/story'

import { FillBlanks } from './components/FillBlanks'
import { StoryReveal } from './components/StoryReveal'
import { TopicPicker } from './components/TopicPicker'
import { Writing } from './components/Writing'

/* Blanks — open-ended tool shape (interaction-models.md, "Session shapes"):
   immediate play, the cave shell stays visible, no end-of-session. Writing a
   story calls a model, so making one sits behind the AI gate; reading a
   shared story (`/blanks#s=…`) does not, so a share link works for anyone. */

type Phase = 'topic' | 'writing' | 'fill' | 'reveal'

const FALLBACK_ERROR = 'Could not write that story. Try again.'

function isTemplate(value: unknown): value is StoryTemplate {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<StoryTemplate>
  return (
    typeof v.title === 'string' &&
    Array.isArray(v.segments) &&
    Array.isArray(v.hints) &&
    v.hints.length > 0 &&
    v.segments.filter(s => s.kind === 'blank').length === v.hints.length
  )
}

function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The location hash on the client; null on the server and during hydration. */
function useHash(): string | null {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => null
  )
}

export default function BlanksApp() {
  const hash = useHash()
  const [makingOwn, setMakingOwn] = useState(false)

  if (hash === null) return <Loading />
  const shared: FilledStory | null = sharedFromHash(hash)

  if (shared && !makingOwn) {
    return (
      <div className="blanks mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
        <Header step={null} />
        <StoryReveal
          story={shared}
          sharedByOther
          onMakeOwn={() => {
            window.history.replaceState(null, '', window.location.pathname)
            setMakingOwn(true)
          }}
        />
      </div>
    )
  }

  return (
    <AiGate game="Blanks" redirectTo="/blanks" fallback={<Loading />}>
      <BlanksGame />
    </AiGate>
  )
}

function Loading() {
  return <p className="py-16 text-center text-sm text-on-surface-variant">Loading…</p>
}

function BlanksGame() {
  const [phase, setPhase] = useState<Phase>('topic')
  const [topic, setTopic] = useState('')
  const [template, setTemplate] = useState<StoryTemplate | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const start = async (chosen: string) => {
    setTopic(chosen)
    setError(null)
    setPhase('writing')
    try {
      const res = await aiFetch('/api/v1/blanks/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: chosen }),
      })
      if (!res.ok) throw new Error(FALLBACK_ERROR)
      const data: unknown = await res.json()
      if (!isTemplate(data)) throw new Error(FALLBACK_ERROR)
      setTemplate(data)
      setWords(Array.from({ length: data.hints.length }, () => ''))
      setPhase('fill')
    } catch (err) {
      setError(aiErrorMessage(err, FALLBACK_ERROR))
      setPhase('topic')
    }
  }

  const refill = () => {
    if (!template) return
    setWords(Array.from({ length: template.hints.length }, () => ''))
    setPhase('fill')
  }

  const newTopic = () => {
    setTemplate(null)
    setWords([])
    setPhase('topic')
  }

  return (
    <div className="blanks mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <Header step={phase === 'topic' || phase === 'writing' ? 1 : phase === 'fill' ? 2 : 3} />

      {phase === 'topic' && <TopicPicker initialTopic={topic} error={error} onStart={start} />}
      {phase === 'writing' && <Writing topic={topic} />}
      {phase === 'fill' && template && (
        <FillBlanks
          template={template}
          words={words}
          onWordsChange={setWords}
          onDone={() => setPhase('reveal')}
        />
      )}
      {phase === 'reveal' && template && (
        <StoryReveal
          story={fillTemplate(template, words)}
          onRefill={refill}
          onNewTopic={newTopic}
        />
      )}
    </div>
  )
}

const STEPS = ['Topic', 'Words', 'Story'] as const

function Header({ step }: { step: 1 | 2 | 3 | null }) {
  return (
    <header className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          Blanks
        </h1>
        <p className="text-sm text-on-surface-variant">
          Fill in the blanks before you see the story.
        </p>
      </div>
      {step && (
        <ol className="blanks-steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className="blanks-step"
              data-state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}
              aria-current={i + 1 === step ? 'step' : undefined}
            >
              <span className="blanks-step-num" aria-hidden="true">
                {i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      )}
    </header>
  )
}
