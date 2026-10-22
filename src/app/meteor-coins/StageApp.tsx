'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { StarRow } from '@/app/meteor-coins/components/StarRow'
import { FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import { SLOW_SPEED } from '@/app/meteor-coins/lib/dropper'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame, type GameEvent } from '@/app/meteor-coins/lib/game'
import {
  headline,
  hudMeasure,
  hudStars,
  nextStarSentence,
  towerLines,
} from '@/app/meteor-coins/lib/goalText'
import {
  type Stars,
  nextPlayableAfter,
  nextStageAfter,
  parseProgress,
  readProgressRaw,
  recordResult,
  saveProgress,
} from '@/app/meteor-coins/lib/progress'
import {
  type GameState,
  homeAt,
  resultValue,
  ringBonus,
  starsFor,
} from '@/app/meteor-coins/lib/rules'
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
/** Fire the cannon with two taps instead of press, hold and let go. */
const TAP_TWICE_KEY = 'meteor-coins:tap-twice'

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}

type Outcome = {
  stars: Stars
  best: number | null
  isNewBest: boolean
  unlockedNext: boolean
  /** A timed run played (at any point) with the slower arm, which stretches the clock. */
  slowed: boolean
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export default function StageApp({ slug }: { slug: string }) {
  const stage = playableStage(slug) as StageDef
  const [game, setGame] = useState<DropGame | null>(null)
  const [run, setRun] = useState(0)
  const [state, setState] = useState<GameState | null>(null)
  // Saved values are read in initializers: they only appear once the physics
  // has loaded in the browser, so server and client markup never disagree.
  const [slow, setSlow] = useState(() => typeof window !== 'undefined' && readFlag(SLOW_KEY))
  const [tapTwice, setTapTwice] = useState(
    () => typeof window !== 'undefined' && readFlag(TAP_TWICE_KEY)
  )
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [debug] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  )
  const fpsRef = useRef(0)
  /** The tempo last called out, so each new step is announced once. */
  const calledTempo = useRef(1)
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
      calledTempo.current = 1
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

  useEffect(() => {
    game?.setCannonMode(tapTwice ? 'tap' : 'hold')
  }, [game, tapTwice])

  // The clock moves between game events, so a timed stage redraws it on its own.
  const [, setClockTick] = useState(0)
  const timed = stage.rules.timeLimitS !== undefined
  useEffect(() => {
    if (!timed || !game) return
    const id = window.setInterval(() => setClockTick(n => n + 1), 250)
    return () => window.clearInterval(id)
  }, [timed, game])

  const onStep = useCallback(
    (events: GameEvent[]) => {
      if (!game) return
      const drops = stage.objects.drop.plural
      for (const e of events) {
        if (e.type === 'phase') {
          const phase = stage.phases?.[e.index]
          if (phase) {
            setPopup({ id: performance.now(), text: `Phase ${e.index + 1}: ${phase.name}` })
            setAnnounce(`Phase ${e.index + 1}, ${phase.name}. ${phase.line}`)
          }
        }
        if (e.type === 'lastPush') {
          setPopup({ id: performance.now(), text: 'Core home! Last Push!' })
          setAnnounce('The comet core is home. Last Push: the pusher reaches twice as far.')
        }
        if (e.type === 'meteor') {
          setPopup({ id: performance.now(), text: 'Meteorite incoming!' })
          setAnnounce('Meteorite incoming. It lands where the countdown ring is.')
        }
        if (e.type === 'hoop') {
          setPopup({ id: performance.now(), text: `Hoop! +${e.bonus} ${drops}` })
          setAnnounce(`Through the ${e.bonus} hoop. ${e.bonus} bonus ${drops}.`)
        }
        if (e.type === 'shot' && e.hit) {
          const text =
            e.streak > 1 ? `+${e.bonus} ${drops} · streak ${e.streak}` : `+${e.bonus} ${drops}`
          setPopup({ id: performance.now(), text })
          setAnnounce(`Ring hit. ${e.bonus} bonus ${drops}.`)
        }
        // Special objects get their own call-out when they go in.
        if (e.type === 'fall' && e.result === 'chute' && e.object !== stage.objects.drop) {
          const extra = e.object.refund
            ? ` +${e.object.refund} coins`
            : e.object.points > 1
              ? ` +${e.object.points}`
              : ''
          setPopup({ id: performance.now(), text: `${capitalize(e.object.name)}!${extra}` })
          setAnnounce(
            `${capitalize(e.object.name)} in.${e.object.refund ? ` ${e.object.refund} coins back.` : ''}`
          )
        }
      }
      const tempoMax = stage.rules.tempo?.max
      if (tempoMax && game.state.tempo !== calledTempo.current) {
        const tempo = game.state.tempo
        if (tempo > calledTempo.current) {
          const text = tempo === tempoMax ? `Tempo ${tempo} — REDLINE` : `Tempo ${tempo}`
          setPopup({ id: performance.now(), text })
          setAnnounce(`${text}.`)
        } else if (tempo === 1) {
          setAnnounce('Off the beat. Tempo 1.')
        }
        calledTempo.current = tempo
      }
      // Record the result once per run, here rather than inside a state
      // updater: React may run updaters twice, and the second run would read
      // back the save the first just made (no "new best", no unlock notice).
      const next = game.state
      if (next.phase === 'over' && recorded.current !== game) {
        recorded.current = game
        const stars = starsFor(next, stage.rules.goal)
        const value = resultValue(next, stage.rules.goal)
        const before = parseProgress(readProgressRaw())
        const previousBest = before.best[stage.slug]
        const following = nextPlayableAfter(stage) ?? nextStageAfter(stage)
        const after = recordResult(before, stage.slug, value, stars)
        saveProgress(after)
        setOutcome({
          stars,
          best: after.best[stage.slug] ?? null,
          isNewBest: value !== null && value > (previousBest ?? 0),
          unlockedNext:
            stars >= 1 && (before.stars[stage.slug] ?? 0) === 0 && following !== undefined,
          slowed: stage.rules.timeLimitS !== undefined && game.slowed,
        })
        const big = headline(stage, next)
        setAnnounce(`Stage over. ${big.value} ${big.caption}, ${stars} of 3 stars.`)
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

  const press = useCallback(() => {
    game?.press()
  }, [game])
  const release = useCallback(() => {
    game?.release()
  }, [game])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' || e.repeat) return
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return
      e.preventDefault()
      if (e.type === 'keydown') press()
      else release()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [press, release])

  const toggleSlow = () => {
    setSlow(s => {
      writeFlag(SLOW_KEY, !s)
      return !s
    })
  }
  const toggleTapTwice = () => {
    setTapTwice(t => {
      writeFlag(TAP_TWICE_KEY, !t)
      return !t
    })
  }

  const over = state?.phase === 'over'
  const slowLabel = stage.cannon ? 'Slower cannon' : 'Slower arm'
  const measure = state ? hudMeasure(stage, state) : null
  const starsNow = state ? hudStars(stage, state) : null
  const towers = state ? towerLines(stage, state) : []
  const timeLeft = state && game ? game.timeLeftS : null

  return (
    <div className="fixed inset-0 z-40 select-none bg-ds-background text-white">
      <Link
        href="/"
        aria-label="Return to the cave"
        className="absolute left-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ✕
      </Link>

      <div
        className="absolute inset-0 touch-none"
        onPointerDown={over ? undefined : press}
        onPointerUp={over ? undefined : release}
        onPointerCancel={over ? undefined : release}
      >
        {game ? (
          <Canvas key={run} dpr={[1, 2]}>
            <color attach="background" args={[PALETTE.background]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 12, 8]} intensity={1.6} />
            <directionalLight position={[-6, 4, -4]} intensity={0.4} />
            <CabinetCamera
              insets={HUD_INSETS}
              layout={game.engine.layout}
              arm={stage.arm}
              cannon={stage.cannon}
            />
            {debug && <FpsMeter fpsRef={fpsRef} />}
            <Scene game={game} onStep={onStep} />
          </Canvas>
        ) : (
          <Loading name={stage.name} />
        )}
      </div>

      {state && measure && starsNow && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-14">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 rounded-lg bg-black/60 px-3 py-2 sm:gap-x-4 sm:px-4">
            <Stat label={capitalize(stage.objects.drop.plural)} value={state.coinsLeft ?? '∞'} />
            {timeLeft !== null && <Stat label="Time" value={clockText(timeLeft)} />}
            {stage.phases && game && (
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-wide text-white/60">
                  Phase {game.phase + 1}/{stage.phases.length}
                </div>
                <div className="text-sm font-bold leading-tight sm:text-base">
                  {stage.phases[game.phase].name}
                </div>
              </div>
            )}
            {stage.rules.tempo && <TempoMeter tempo={state.tempo} max={stage.rules.tempo.max} />}
            <Stat label={measure.label} value={measure.value} />
            {towers.length > 0 && (
              <ul
                aria-label="Towers"
                className="text-[11px] leading-tight tabular-nums text-white/80"
              >
                {towers.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div className="text-center">
              <StarRow earned={starsNow.stars} size={16} label={starsNow.label} />
              <div className="text-[11px] tabular-nums text-white/70">{starsNow.note}</div>
            </div>
            {state.streak > 0 && (
              <div className="text-xs leading-tight text-white/80">
                Streak {state.streak}
                <br />
                next +{ringBonus(state.streak + 1, state.tempo, stage.rules)}
              </div>
            )}
          </div>
        </div>
      )}

      {state && !over && (
        <button
          type="button"
          aria-pressed={slow}
          aria-label={slowLabel}
          title={slowLabel}
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
          <span className="hidden sm:inline">{slowLabel}</span>
        </button>
      )}

      {state && !over && stage.cannon && (
        <button
          type="button"
          aria-pressed={tapTwice}
          aria-label="Tap twice to fire"
          title="Tap twice to fire"
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => e.stopPropagation()}
          onClick={toggleTapTwice}
          className={`absolute right-2 top-16 z-50 flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
            tapTwice
              ? 'border-white/60 bg-white/15 text-white'
              : 'border-white/20 bg-black/40 text-white/70 hover:text-white'
          }`}
        >
          <span aria-hidden className="material-symbols-outlined text-[20px]">
            touch_app
          </span>
          <span className="hidden sm:inline">Tap twice</span>
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
                {stage.cannon
                  ? tapTwice
                    ? 'Tap or press Space to aim, and again to fire. '
                    : 'Press and hold to aim; how long you hold sets the distance. Let go to fire. '
                  : 'Tap or press Space to drop. '}
                {stage.ring.enabled &&
                  !stage.rules.tempo &&
                  `Hit the ring for bonus ${stage.objects.drop.plural}. `}
                {stage.hint && `${stage.hint} `}
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

/**
 * Whether the result earns the stage's "clear" line. On Comet Homecoming
 * finishing is a star, but the clear line is about the core getting home.
 */
function cleared(stage: StageDef, state: GameState, stars: number): boolean {
  const { goal } = stage.rules
  if (goal.type === 'homecoming') return homeAt(state, goal)
  return stars >= 1
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

/** Seconds as m:ss, rounded up so the clock reads 0:00 only when it's out. */
function clockText(seconds: number): string {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The tempo as a number and a row of pips, so it reads without color. */
function TempoMeter({ tempo, max }: { tempo: number; max: number }) {
  return (
    <div className="text-center" aria-label={`Tempo ${tempo} of ${max}`} role="img">
      <div className="text-[11px] uppercase tracking-wide text-white/60">
        {tempo === max ? 'Redline' : 'Tempo'}
      </div>
      <div className="text-xl font-bold tabular-nums leading-none sm:text-2xl">{tempo}</div>
      <div aria-hidden className="mt-0.5 flex justify-center gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i < tempo ? 'bg-white' : 'border border-white/40'}`}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-xl font-bold tabular-nums leading-none sm:text-2xl">{value}</div>
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
  const following = nextPlayableAfter(stage) ?? nextStageAfter(stage)
  const canAdvance = outcome.stars >= 1 && following?.playable
  const big = headline(stage, state)
  const hasGutters = stage.table.chuteHalfWidth < FIELD_HALF_WIDTH

  const share = async () => {
    const url = `${window.location.origin}/meteor-coins/${stage.slug}`
    const text = `I got ${big.value} ${big.caption} on ${stage.name} (${outcome.stars} of 3 stars) in Meteor Coins.`
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
        <p className="mt-2 text-6xl font-extrabold tabular-nums">{big.value}</p>
        <p className="text-sm text-white/70">{big.caption}</p>
        <div className="mt-3 flex justify-center">
          <StarRow earned={outcome.stars} size={30} label={`${outcome.stars} of 3 stars`} />
        </div>
        {stage.rules.tempo && state.bestTempo >= stage.rules.tempo.max && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
            <span aria-hidden className="material-symbols-outlined text-[16px]">
              speed
            </span>
            Redline reached
          </p>
        )}
        {outcome.slowed && <p className="mt-1 text-xs text-white/70">Played with Slower arm.</p>}
        <p className="mt-2 text-sm italic text-white/90">
          {cleared(stage, state, outcome.stars) ? stage.voice.clear : stage.voice.miss}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {nextStarSentence(stage, state)}{' '}
          {outcome.isNewBest
            ? 'New personal best!'
            : !!outcome.best && `Your best: ${outcome.best}.`}
        </p>
        {outcome.unlockedNext && following && (
          <p className="mt-2 text-sm font-semibold text-white">
            {following.playable
              ? `Stage ${following.number} unlocked: ${following.name}.`
              : `You've cleared every stage built so far. Stage ${following.number} is coming soon.`}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
          {stage.rules.tempo && (
            <div>
              <dt>Top tempo</dt>
              <dd className="text-base font-semibold text-white">{state.bestTempo}</dd>
            </div>
          )}
          {stage.cannon && (
            <div>
              <dt>Hoops</dt>
              <dd className="text-base font-semibold text-white">{state.hits}</dd>
            </div>
          )}
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
          {hasGutters && (
            <div>
              <dt>Gutters</dt>
              <dd className="text-base font-semibold text-white">{state.lost}</dd>
            </div>
          )}
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
