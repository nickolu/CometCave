'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { StarRow } from '@/app/meteor-coins/components/StarRow'
import { SLOW_SPEED } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame, type GameEvent } from '@/app/meteor-coins/lib/game'
import {
  type Stars,
  nextStageAfter,
  parseProgress,
  readProgressRaw,
  recordResult,
  saveProgress,
} from '@/app/meteor-coins/lib/progress'
import { type GameState, nextStar, starsFor } from '@/app/meteor-coins/lib/rules'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { CabinetCamera, Scene } from '@/app/meteor-coins/scene/Scene'

/**
 * One Meteor Coins stage in play.
 *
 * Session shape: run-loop. Each stage has its own budget, table and stars;
 * "Next stage" (after a star) or "Try again" is the next action. The arm
 * swings on its own; a tap (or Space) drops a coin from its tip.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */

/** Screen space the HUD covers; the camera keeps the cabinet out of it. */
const HUD_INSETS = { top: 72, bottom: 40, side: 8 }

const SLOW_KEY = 'meteor-coins:slow'

function readSlow(): boolean {
  try {
    return window.localStorage.getItem(SLOW_KEY) === '1'
  } catch {
    return false
  }
}

function writeSlow(slow: boolean) {
  try {
    window.localStorage.setItem(SLOW_KEY, slow ? '1' : '0')
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}

type Outcome = { stars: Stars; best: number; isNewBest: boolean; unlockedNext: boolean }

export default function StageApp({ slug }: { slug: string }) {
  const stage = playableStage(slug) as StageDef
  const [game, setGame] = useState<DropGame | null>(null)
  const [run, setRun] = useState(0)
  const [state, setState] = useState<GameState | null>(null)
  // Saved values are read in initializers: they only appear once the physics
  // has loaded in the browser, so server and client markup never disagree.
  const [slow, setSlow] = useState(() => typeof window !== 'undefined' && readSlow())
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [debug] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  )
  const fpsRef = useRef(0)
  /** The run whose result has been saved, so it's saved exactly once. */
  const recorded = useRef<DropGame | null>(null)
  const primaryAction = useRef<HTMLAnchorElement | HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let created: DropGame | null = null
    initPhysics().then(() => {
      if (cancelled) return
      created = new DropGame(stage)
      setGame(created)
      setState(created.state)
      setOutcome(null)
    })
    return () => {
      cancelled = true
      created?.dispose()
      setGame(null)
    }
  }, [run, stage])

  useEffect(() => {
    game?.setSpeed(slow ? SLOW_SPEED : 1)
  }, [game, slow])

  const onStep = useCallback(
    (events: GameEvent[]) => {
      if (!game) return
      for (const e of events) {
        if (e.type === 'shot' && e.hit) {
          const text = e.streak > 1 ? `+${e.bonus} coins · streak ${e.streak}` : `+${e.bonus} coins`
          setPopup({ id: performance.now(), text })
          setAnnounce(`Ring hit. ${e.bonus} bonus coins.`)
        }
      }
      // Record the result once per run, here rather than inside a state
      // updater: React may run updaters twice, and the second run would read
      // back the save the first just made (no "new best", no unlock notice).
      const next = game.state
      if (next.phase === 'over' && recorded.current !== game) {
        recorded.current = game
        const stars = starsFor(next.score, stage.rules.stars)
        const before = parseProgress(readProgressRaw())
        const previousBest = before.best[stage.slug] ?? 0
        const following = nextStageAfter(stage)
        saveProgress(recordResult(before, stage.slug, next.score, stars))
        setOutcome({
          stars,
          best: Math.max(previousBest, next.score),
          isNewBest: next.score > previousBest,
          unlockedNext:
            stars >= 1 && (before.stars[stage.slug] ?? 0) === 0 && following !== undefined,
        })
        setAnnounce(`Stage over. Score ${next.score}, ${stars} of 3 stars.`)
      }
      setState(prev => (prev === next ? prev : next))
    },
    [game, stage]
  )

  useEffect(() => {
    if (!popup) return
    const id = window.setTimeout(() => setPopup(null), 1400)
    return () => window.clearTimeout(id)
  }, [popup])

  useEffect(() => {
    if (outcome) primaryAction.current?.focus()
  }, [outcome])

  const tap = useCallback(() => {
    game?.tapDrop()
  }, [game])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' || e.repeat) return
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return
      e.preventDefault()
      tap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tap])

  const toggleSlow = () => {
    setSlow(s => {
      writeSlow(!s)
      return !s
    })
  }

  const over = state?.phase === 'over'
  const upcoming = state ? nextStar(state.score, stage.rules.stars) : null
  const earnedSoFar = state ? starsFor(state.score, stage.rules.stars) : 0

  return (
    <div className="fixed inset-0 z-40 select-none bg-ds-background text-white">
      <Link
        href="/"
        aria-label="Return to the cave"
        className="absolute left-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ✕
      </Link>

      <div className="absolute inset-0" onPointerDown={over ? undefined : tap}>
        {game ? (
          <Canvas key={run} dpr={[1, 2]}>
            <color attach="background" args={[PALETTE.background]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 12, 8]} intensity={1.6} />
            <directionalLight position={[-6, 4, -4]} intensity={0.4} />
            <CabinetCamera insets={HUD_INSETS} />
            {debug && <FpsMeter fpsRef={fpsRef} />}
            <Scene game={game} onStep={onStep} />
          </Canvas>
        ) : (
          <Loading name={stage.name} />
        )}
      </div>

      {state && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-14">
          <div className="flex items-center gap-4 rounded-lg bg-black/60 px-4 py-2">
            <Stat label="Coins" value={state.coinsLeft ?? '∞'} />
            <Stat label="Score" value={state.score} />
            <div className="text-center">
              <StarRow
                earned={earnedSoFar}
                size={16}
                label={
                  upcoming
                    ? `${earnedSoFar} of 3 stars. Next star at ${upcoming.at}.`
                    : '3 of 3 stars.'
                }
              />
              <div className="text-[11px] tabular-nums text-white/70">
                {upcoming ? `next at ${upcoming.at}` : 'all stars'}
              </div>
            </div>
            {state.streak > 0 && (
              <div className="text-xs leading-tight text-white/80">
                Streak {state.streak}
                <br />
                next +{stage.rules.bonusForStreak(state.streak + 1)}
              </div>
            )}
          </div>
        </div>
      )}

      {state && !over && (
        <button
          type="button"
          aria-pressed={slow}
          aria-label="Slower arm"
          title="Slower arm"
          onPointerDown={e => e.stopPropagation()}
          onClick={toggleSlow}
          className={`absolute right-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
            slow
              ? 'border-white/60 bg-white/15 text-white'
              : 'border-white/20 bg-black/40 text-white/70 hover:text-white'
          }`}
        >
          <span aria-hidden className="material-symbols-outlined text-[20px]">
            slow_motion_video
          </span>
          <span className="hidden sm:inline">Slower arm</span>
        </button>
      )}

      {popup && (
        <div
          key={popup.id}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-20 z-40 text-center text-2xl font-bold"
          style={{ color: PALETTE.ringHit }}
        >
          {popup.text}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {state && (state.phase === 'ready' || state.phase === 'settling') && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-0.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
          {state.phase === 'ready' ? (
            <>
              <p className="text-xs uppercase tracking-wide text-white/60">
                Stage {stage.number} · {stage.name}
              </p>
              <p className="text-xs text-white/80 sm:text-sm">
                Tap or press Space to drop. {stage.ring.enabled && 'Hit the ring for bonus coins. '}
                <span className="italic">{stage.voice.start}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-white/70 sm:text-sm">Last coins settling…</p>
          )}
        </div>
      )}

      {over && state && outcome && (
        <ResultPanel
          stage={stage}
          state={state}
          outcome={outcome}
          primaryRef={primaryAction}
          onTryAgain={() => setRun(r => r + 1)}
        />
      )}

      {debug && game && <DebugReadout game={game} fpsRef={fpsRef} />}
    </div>
  )
}

function Loading({ name }: { name: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 text-sm text-white/70"
      role="status"
    >
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-4 motion-reduce:animate-none"
        style={{
          borderColor: PALETTE.puck,
          borderTopColor: 'transparent',
          animationDuration: '1.2s',
        }}
      />
      Loading {name}…
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
    </div>
  )
}

const buttonBase =
  'flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'
const primaryClass = `${buttonBase} bg-ds-primary text-on-primary`
const secondaryClass = `${buttonBase} border border-white/25 hover:bg-white/10`

function ResultPanel({
  stage,
  state,
  outcome,
  primaryRef,
  onTryAgain,
}: {
  stage: StageDef
  state: GameState
  outcome: Outcome
  primaryRef: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>
  onTryAgain: () => void
}) {
  const [status, setStatus] = useState('')
  const following = nextStageAfter(stage)
  const canAdvance = outcome.stars >= 1 && following?.playable
  const upcoming = nextStar(state.score, stage.rules.stars)

  const share = async () => {
    const url = `${window.location.origin}/meteor-coins/${stage.slug}`
    const text = `I scored ${state.score} on ${stage.name} (${outcome.stars} of 3 stars) in Meteor Coins.`
    try {
      if (navigator.share) {
        await navigator.share({ title: `Meteor Coins: ${stage.name}`, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setStatus('Copied to clipboard.')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setStatus('Could not copy.')
    }
    setTimeout(() => setStatus(''), 2500)
  }

  const tryAgain = (
    <button
      ref={canAdvance ? undefined : (primaryRef as React.RefObject<HTMLButtonElement>)}
      type="button"
      onClick={onTryAgain}
      className={canAdvance ? secondaryClass : primaryClass}
    >
      Try again
    </button>
  )

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <section
        aria-labelledby="result-heading"
        className="w-full max-w-sm rounded-xl border border-white/15 bg-ds-background p-6 text-center"
      >
        <p className="text-xs uppercase tracking-wide text-white/60">Stage {stage.number}</p>
        <h2 id="result-heading" className="text-lg font-bold">
          {stage.name}
        </h2>
        <p className="mt-2 text-6xl font-extrabold tabular-nums">{state.score}</p>
        <p className="text-sm text-white/70">coins into the chute</p>
        <div className="mt-3 flex justify-center">
          <StarRow earned={outcome.stars} size={30} label={`${outcome.stars} of 3 stars`} />
        </div>
        <p className="mt-2 text-sm italic text-white/90">
          {outcome.stars >= 1 ? stage.voice.clear : stage.voice.miss}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {upcoming
            ? `${upcoming.at} for ${upcoming.stars === 1 ? 'a star' : `${upcoming.stars} stars`}.`
            : 'Every star on this stage.'}{' '}
          {outcome.isNewBest ? 'New personal best!' : `Your best: ${outcome.best}.`}
        </p>
        {outcome.unlockedNext && following && (
          <p className="mt-2 text-sm font-semibold text-white">
            {following.playable
              ? `Stage ${following.number} unlocked: ${following.name}.`
              : `You've cleared every stage built so far. Stage ${following.number} is coming soon.`}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
          {stage.ring.enabled && (
            <div>
              <dt>Ring hits</dt>
              <dd className="text-base font-semibold text-white">
                {state.hits}/{state.shots}
              </dd>
            </div>
          )}
          {stage.ring.enabled && (
            <div>
              <dt>Best streak</dt>
              <dd className="text-base font-semibold text-white">{state.bestStreak}</dd>
            </div>
          )}
          <div>
            <dt>Gutters</dt>
            <dd className="text-base font-semibold text-white">{state.lost}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          {canAdvance && following && (
            <Link
              ref={primaryRef as React.RefObject<HTMLAnchorElement>}
              href={`/meteor-coins/${following.slug}`}
              className={primaryClass}
            >
              Next stage: {following.name}
            </Link>
          )}
          {tryAgain}
          <button type="button" onClick={share} className={secondaryClass}>
            Share score
          </button>
          <Link
            href="/meteor-coins"
            className="min-h-11 py-3 text-sm text-white/70 underline-offset-4 hover:underline"
          >
            Stage map
          </Link>
        </div>
        <p className="mt-2 h-4 text-xs text-white/70" role="status">
          {status}
        </p>
      </section>
    </div>
  )
}

/** Smoothed frames-per-second, written to a ref so it never re-renders the scene. */
function FpsMeter({ fpsRef }: { fpsRef: React.RefObject<number> }) {
  const acc = useRef({ frames: 0, time: 0 })
  useFrame((_, delta) => {
    acc.current.frames++
    acc.current.time += delta
    if (acc.current.time >= 0.5) {
      fpsRef.current = Math.round(acc.current.frames / acc.current.time)
      acc.current = { frames: 0, time: 0 }
    }
  })
  return null
}

/** Add ?debug to the URL for the performance readout from the physics test. */
function DebugReadout({ game, fpsRef }: { game: DropGame; fpsRef: React.RefObject<number> }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const id = window.setInterval(() => {
      const { live, asleep } = game.engine.countActive()
      setText(
        `${fpsRef.current} fps · ${live} live · ${asleep} asleep · t=${game.engine.time.toFixed(1)}s`
      )
    }, 250)
    return () => window.clearInterval(id)
  }, [game, fpsRef])
  return (
    <div className="pointer-events-none absolute bottom-20 right-2 z-50 rounded bg-black/60 px-2 py-1 font-mono text-xs">
      {text}
    </div>
  )
}
