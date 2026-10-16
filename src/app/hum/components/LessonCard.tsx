'use client'

import { LESSONS } from '@/app/hum/lib/lessons'
import type { Hum } from '@/app/hum/useHum'
import { ChunkyButton } from '@/components/ui/chunky-button'

export function LessonCard({ hum }: { hum: Hum }) {
  if (hum.visiting) return <VisitCard hum={hum} />
  if (!hum.lesson) return <StudioCard hum={hum} />

  const { index, goal, done } = hum.lesson
  const l = LESSONS[index]
  const last = index === LESSONS.length - 1

  return (
    <section aria-labelledby="hum-lesson-title" className="hum-card">
      <p className="hum-eyebrow">
        Lesson {index + 1} of {LESSONS.length}
      </p>
      <h2 id="hum-lesson-title" className="font-headline text-xl font-extrabold text-on-surface">
        {l.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{l.intro}</p>

      <ol className="mt-3 flex flex-col gap-2" aria-label="Goals">
        {l.goals.map((g, i) => {
          const state = i < goal ? 'done' : i === goal ? 'now' : 'later'
          return (
            <li key={g.text} className={`hum-goal hum-goal-${state}`}>
              <span className="hum-goal-mark" aria-hidden="true">
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span>
                {g.text}
                <span className="sr-only">
                  {state === 'done' ? ' (done)' : state === 'now' ? ' (current goal)' : ''}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      {/* Said aloud too, since the card changing is the whole reward. */}
      <div aria-live="polite">
        {done && (
          <div className="hum-takeaway">
            <p className="text-sm leading-relaxed text-on-surface">{l.takeaway}</p>
            <ChunkyButton className="mt-3" onClick={hum.nextLesson}>
              {last ? 'Open the Studio' : `Next: ${LESSONS[index + 1].title}`}
            </ChunkyButton>
          </div>
        )}
      </div>

      {!done && (
        <button type="button" className="hum-link mt-3" onClick={hum.skipToStudio}>
          Already know synths? Skip to the full studio
        </button>
      )}
    </section>
  )
}

function StudioCard({ hum }: { hum: Hum }) {
  const finished = hum.state.completed >= LESSONS.length
  return (
    <section aria-labelledby="hum-studio-title" className="hum-card">
      <p className="hum-eyebrow">{finished ? 'All lessons done' : 'Studio'}</p>
      <h2 id="hum-studio-title" className="font-headline text-xl font-extrabold text-on-surface">
        The Studio
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Every knob is out. Build a sound, put it in the beat, and share the link.
      </p>
      <details className="hum-review mt-3">
        <summary>Review a lesson</summary>
        <ol className="mt-2 flex flex-col gap-3">
          {LESSONS.map((l, i) => (
            <li key={l.id}>
              <p className="text-sm font-semibold text-on-surface">
                {i + 1}. {l.title}
              </p>
              <p className="text-sm text-on-surface-variant">{l.takeaway}</p>
            </li>
          ))}
        </ol>
      </details>
      {!finished && (
        <button type="button" className="hum-link mt-3" onClick={hum.backToLessons}>
          Back to the lessons (lesson {hum.state.completed + 1})
        </button>
      )}
    </section>
  )
}

function VisitCard({ hum }: { hum: Hum }) {
  return (
    <section aria-labelledby="hum-visit-title" className="hum-card">
      <p className="hum-eyebrow">Shared with you</p>
      <h2 id="hum-visit-title" className="font-headline text-xl font-extrabold text-on-surface">
        Someone made this beat
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Every sound in it started as a flat line. All the knobs that built it are out below, so you
        can change it, or learn how it was made, one knob at a time.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ChunkyButton onClick={() => hum.leaveVisit(false)}>Learn how it was made</ChunkyButton>
        <ChunkyButton variant="secondary" onClick={() => hum.leaveVisit(true)}>
          Keep this beat
        </ChunkyButton>
      </div>
    </section>
  )
}
