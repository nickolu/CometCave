'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { BeatGrid } from './components/BeatGrid'
import { KnobColumn, LEFT_GROUPS, RIGHT_GROUPS, SoundBar } from './components/KnobPanel'
import { LessonCard } from './components/LessonCard'
import { Scope } from './components/Scope'
import { noteName } from './lib/patch'
import { type Hum, useHum } from './useHum'

/* Hum — open-ended tool shape (interaction-models.md, "Session shapes"):
   immediate play, the cave shell stays visible, no end-of-session. */

const REDUCED = '(prefers-reduced-motion: reduce)'

function subscribeReduced(on: () => void) {
  const mq = window.matchMedia(REDUCED)
  mq.addEventListener('change', on)
  return () => mq.removeEventListener('change', on)
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false
  )
}

export default function HumApp() {
  const hum = useHum()
  const reducedMotion = useReducedMotion()
  const { pressPlay, releasePlay } = hum

  // Space plays a note too, unless it would press a focused button or type.
  useEffect(() => {
    const skip = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.closest('button, input, textarea, select, summary, a') !== null || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || skip(e.target)) return
      e.preventDefault()
      pressPlay()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || skip(e.target)) return
      e.preventDefault()
      releasePlay()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [pressPlay, releasePlay])

  if (!hum.loaded) {
    return <p className="py-16 text-center text-sm text-on-surface-variant">Loading…</p>
  }

  const sounding = hum.playing || hum.beatOn
  const scopeLabel = sounding
    ? `The scope, ${hum.view} view. Drawing the sound: ${hum.patch.wave} wave, ${noteName(hum.patch.pitch)}.`
    : 'The scope. A flat line: silence.'

  return (
    <div className="hum mx-auto flex w-full max-w-6xl flex-col gap-5 py-4">
      <Header hum={hum} />

      <div className="hum-layout">
        <div className="hum-area-center hum-stage">
          <div className="hum-scope-wrap">
            <Scope
              analyser={hum.engine?.analyser ?? null}
              view={hum.view}
              reducedMotion={reducedMotion}
              label={scopeLabel}
            />
            {hum.visiting && !hum.engine && (
              <button
                type="button"
                className="hum-scope-start"
                onClick={() => {
                  hum.ensureEngine()
                  hum.toggleBeat()
                }}
              >
                Tap to play this beat
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex gap-2" role="group" aria-label="Scope view">
              <button
                type="button"
                className="hum-seg"
                aria-pressed={hum.view === 'close'}
                onClick={() => hum.setView('close')}
              >
                Close: 20 ms
              </button>
              <button
                type="button"
                className="hum-seg"
                aria-pressed={hum.view === 'wide'}
                onClick={() => hum.setView('wide')}
              >
                Wide: 1 second
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`hum-play${hum.playing ? ' hum-play-on' : ''}`}
                aria-pressed={hum.playing}
                aria-label={
                  hum.hold
                    ? 'Playing (held). Turn off Hold to stop.'
                    : 'Play. Press and hold to sound a note, or hold the space bar.'
                }
                onPointerDown={e => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  pressPlay()
                }}
                onPointerUp={releasePlay}
                onPointerCancel={releasePlay}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                    e.preventDefault()
                    pressPlay()
                  }
                }}
                onKeyUp={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    releasePlay()
                  }
                }}
                onContextMenu={e => e.preventDefault()}
              >
                <span aria-hidden="true">{hum.playing ? '◉' : '▶'}</span>
                Play
              </button>
              <button
                type="button"
                className="hum-seg"
                aria-pressed={hum.hold}
                onClick={hum.toggleHold}
              >
                Hold
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-on-surface-variant">
            Hold Play (or the space bar) to sound a note.
          </p>
          <SoundBar hum={hum} />
        </div>

        <div className="hum-area-lesson">
          <LessonCard hum={hum} />
        </div>
        <div className="hum-area-left">
          <KnobColumn hum={hum} groups={LEFT_GROUPS} />
        </div>
        <div className="hum-area-right">
          <KnobColumn hum={hum} groups={RIGHT_GROUPS} />
        </div>
      </div>

      {hum.gridUnlocked && <BeatGrid hum={hum} />}
    </div>
  )
}

function Header({ hum }: { hum: Hum }) {
  const [status, setStatus] = useState('')

  const share = async () => {
    const url = hum.shareUrl()
    const text = 'I made this beat from a flat line.'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Hum', text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setStatus('Link copied.')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setStatus('Could not copy the link.')
    }
    setTimeout(() => setStatus(''), 2500)
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface">Hum</h1>
        <p className="text-sm text-on-surface-variant">See sound, shape it, make a beat.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="hum-icon-btn"
          aria-pressed={hum.muted}
          aria-label={hum.muted ? 'Unmute' : 'Mute'}
          onClick={() => hum.setMuted(!hum.muted)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {hum.muted ? 'volume_off' : 'volume_up'}
          </span>
        </button>
        <ChunkyButton size="sm" variant="secondary" onClick={share}>
          Share
        </ChunkyButton>
        <span role="status" className="text-xs text-on-surface-variant">
          {status}
        </span>
      </div>
    </header>
  )
}
