'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PlaceLine } from '@/app/meteor-coins/components/PlaceLine'
import { ScoreBoard } from '@/app/meteor-coins/components/ScoreBoard'
import { StarRow } from '@/app/meteor-coins/components/StarRow'
import { useScores } from '@/app/meteor-coins/hooks/useScores'
import { FIELD_FRONT_Z, FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import {
  deliveryAimY,
  deliveryHolds,
  deliveryHowTo,
  deliveryName,
  deliveryOf,
} from '@/app/meteor-coins/lib/deliveries'
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
import type { BoardView, Placement } from '@/app/meteor-coins/lib/scoreboard'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { usePrefersReducedMotion } from '@/app/meteor-coins/scene/reducedMotion'
import {
  CabinetCamera,
  Scene,
  type TableProjection,
  TableProjector,
} from '@/app/meteor-coins/scene/Scene'
import { NicknameDialog } from '@/components/nickname-dialog'

/**
 * One Meteor Coins stage in play.
 *
 * Session shape: run-loop. Each stage has its own budget, table and stars;
 * "Next stage" (after a star) or "Try again" is the next action. Each stage
 * has its own way of getting coins onto the table (lib/deliveries): a tap
 * (or Space) drops, fires or lets go; the pointer and arrow keys aim.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */

/** Screen space the HUD covers; the camera keeps the cabinet out of it. */
const HUD_INSETS = { top: 72, bottom: 40, side: 8 }

const SLOW_KEY = 'meteor-coins:slow'
/** Play held deliveries (the cannon, the plunger) with taps instead of press, hold and let go. */
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

/** Whether the run's score has reached the server's boards yet. */
type Saving = 'idle' | 'saving' | 'failed'

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
  const scoring = useScores()
  const [saving, setSaving] = useState<Saving>('idle')
  /** This stage's board as the save left it, for the result panel. */
  const [board, setBoard] = useState<BoardView | null>(null)
  const [naming, setNaming] = useState(false)
  /** The save call, read through a ref so a sign-in mid-run can't rebuild the handler. */
  const sendScore = useRef(scoring.send)
  useEffect(() => {
    sendScore.current = scoring.send
  }, [scoring.send])
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  /**
   * The phase the cabinet is in, where phases change the delivery (so the
   * controls, framing and how-to follow it), and the banner announcing it:
   * which phase, and the coins left as it started.
   */
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [banner, setBanner] = useState<{ index: number; coinsAt: number | null } | null>(null)
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
      setPhaseIndex(0)
      setBanner(stage.phases?.[0]?.tool ? { index: 0, coinsAt: created.state.coinsLeft } : null)
      calledTempo.current = 1
      setOutcome(null)
      setBoard(null)
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
    game?.delivery.setMode?.(tapTwice ? 'tap' : 'hold')
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
            setPhaseIndex(e.index)
            // A phase with its own delivery gets a banner; others a pop-up.
            if (phase.tool) setBanner({ index: e.index, coinsAt: game.state.coinsLeft })
            else setPopup({ id: performance.now(), text: `Phase ${e.index + 1}: ${phase.name}` })
            const how = phase.delivery ? ` ${deliveryHowTo(phase.delivery, tapTwice)}` : ''
            setAnnounce(`Phase ${e.index + 1}, ${phase.name}. ${phase.line}${how}`)
          }
        }
        if (e.type === 'lastPush') {
          setPopup({ id: performance.now(), text: 'The comet is home! Last Push!' })
          setAnnounce(
            'The comet is home. Last Push: the pusher reaches twice as far for a few seconds.'
          )
        }
        if (e.type === 'meteor') {
          setPopup({ id: performance.now(), text: 'Meteorite incoming!' })
          setAnnounce('Meteorite incoming. It lands where the countdown ring is.')
        }
        if (e.type === 'plate') {
          if (e.plate === 'gold') {
            setPopup({ id: performance.now(), text: `${e.line} +${e.bonus} ${drops}` })
            setAnnounce(`Gold plate on the ${e.deck}. ${e.bonus} bonus ${drops}.`)
          } else {
            setPopup({ id: performance.now(), text: e.line })
            setAnnounce(`Red plate on the ${e.deck}. Its edge is blocked for ${e.seconds} seconds.`)
          }
        }
        if (e.type === 'callout') {
          setPopup({ id: performance.now(), text: e.text })
          setAnnounce(e.announce)
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
        // The board gets this browser's best, which the run may have raised.
        const best = after.best[stage.slug]
        if (best !== undefined) {
          setSaving('saving')
          sendScore
            .current([{ stage: stage.slug, value: best, stars: after.stars[stage.slug] ?? stars }])
            .then(saved => {
              setSaving(saved ? 'idle' : 'failed')
              setBoard(saved?.boards[stage.slug] ?? null)
            })
        }
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
    [game, stage, tapTwice]
  )

  // A phase's banner stays up for a while, and longer before the first coin.
  useEffect(() => {
    if (!banner || banner.index === 0) return
    const id = window.setTimeout(() => setBanner(null), 9000)
    return () => window.clearTimeout(id)
  }, [banner])

  useEffect(() => {
    if (!popup) return
    const id = window.setTimeout(() => setPopup(null), 1400)
    return () => window.clearTimeout(id)
  }, [popup])

  useEffect(() => {
    if (outcome) primaryAction.current?.focus()
  }, [outcome])

  const press = useCallback(() => {
    game?.input({ type: 'press' })
  }, [game])
  const release = useCallback(() => {
    game?.input({ type: 'release' })
  }, [game])

  const delivery = useMemo(() => deliveryOf(stage, phaseIndex), [stage, phaseIndex])
  // A phase's own moon: its whole orbit stays in view, with the moon's size to spare.
  const framingExtra = useMemo(() => {
    const m = stage.phases?.[phaseIndex]?.moon
    if (!m) return undefined
    const { x, y, z } = m.center
    return [
      { x: x - m.radiusX - 0.6, y: y + 0.6, z },
      { x: x + m.radiusX + 0.6, y: y + 0.6, z },
      { x, y: y + 0.6, z: z - m.radiusZ - 0.6 },
      { x, y: y + 0.6, z: z + m.radiusZ + 0.6 },
    ]
  }, [stage, phaseIndex])
  // Where the pointer is over the table, for deliveries that aim by it.
  const project = useRef<TableProjection | null>(null)
  const point = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!game || !project.current) return
      const box = e.currentTarget.getBoundingClientRect()
      const ndcX = ((e.clientX - box.left) / box.width) * 2 - 1
      const ndcY = -((e.clientY - box.top) / box.height) * 2 + 1
      const aimY = deliveryAimY(delivery)
      const at = project.current(ndcX, ndcY, aimY)
      const up = project.current(ndcX, ndcY, aimY + 1)
      const rise = up && at ? { x: up.x - at.x, z: up.z - at.z } : undefined
      if (at) game.input({ type: 'point', x: at.x, z: at.z, rise })
    },
    [game, delivery]
  )
  const pointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      point(e)
      press()
    },
    [point, press]
  )

  // Arrow keys steer deliveries that move; the game hears the held direction.
  useEffect(() => {
    if (!game) return
    const held = new Set<string>()
    const axis = (minus: string, plus: string) =>
      (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0)
    function onArrow(e: KeyboardEvent) {
      if (!e.key.startsWith('Arrow')) return
      if (
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLAnchorElement ||
        e.target instanceof HTMLInputElement
      )
        return
      e.preventDefault()
      if (e.type === 'keydown') held.add(e.key)
      else held.delete(e.key)
      game?.input({
        type: 'steer',
        x: axis('ArrowLeft', 'ArrowRight'),
        z: axis('ArrowUp', 'ArrowDown'),
      })
    }
    window.addEventListener('keydown', onArrow)
    window.addEventListener('keyup', onArrow)
    return () => {
      window.removeEventListener('keydown', onArrow)
      window.removeEventListener('keyup', onArrow)
    }
  }, [game])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' || e.repeat) return
      if (
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLAnchorElement ||
        e.target instanceof HTMLInputElement
      )
        return
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

  // A toggle clicked with the pointer gives focus back to the game, so Space
  // drops again rather than flipping the toggle. (From the keyboard, focus
  // stays where the player put it.)
  const giveBackFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail > 0) e.currentTarget.blur()
  }
  const toggleSlow = (e: React.MouseEvent<HTMLButtonElement>) => {
    giveBackFocus(e)
    setSlow(s => {
      writeFlag(SLOW_KEY, !s)
      return !s
    })
  }
  const toggleTapTwice = (e: React.MouseEvent<HTMLButtonElement>) => {
    giveBackFocus(e)
    setTapTwice(t => {
      writeFlag(TAP_TWICE_KEY, !t)
      return !t
    })
  }

  const over = state?.phase === 'over'
  const slowLabel = `Slower ${deliveryName(delivery)}`
  const measure = state ? hudMeasure(stage, state) : null
  const starsNow = state ? hudStars(stage, state) : null
  const towers = state ? towerLines(stage, state) : []
  const timeLeft = state && game ? game.timeLeftS : null
  // The banner goes once the phase's second coin is away.
  const bannerPhase =
    banner && state && !over && (banner.coinsAt ?? 0) - (state.coinsLeft ?? 0) < 2
      ? stage.phases?.[banner.index]
      : undefined

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
        onPointerDown={over ? undefined : pointerDown}
        onPointerMove={over ? undefined : point}
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
              delivery={delivery}
              extra={framingExtra}
            />
            <TableProjector projectRef={project} />
            {debug && <FpsMeter fpsRef={fpsRef} />}
            <Scene game={game} onStep={onStep} />
          </Canvas>
        ) : (
          <Loading name={stage.name} />
        )}
      </div>

      {state && measure && starsNow && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex flex-col items-center gap-2 px-14">
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
            {stage.lastPush && game && <HomeMeter game={game} />}
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
          {bannerPhase && stage.phases && banner && (
            <PhaseBanner
              key={banner.index}
              number={banner.index + 1}
              of={stage.phases.length}
              name={bannerPhase.name}
              tool={bannerPhase.tool}
              line={bannerPhase.line}
              howTo={deliveryHowTo(deliveryOf(stage, banner.index), tapTwice)}
            />
          )}
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

      {state && !over && deliveryHolds(delivery) && (
        <button
          type="button"
          aria-pressed={tapTwice}
          aria-label="Tap instead of holding"
          title="Tap instead of holding"
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
          <span className="hidden sm:inline">Tap, don&apos;t hold</span>
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
                {!stage.phases?.[0]?.tool && `${deliveryHowTo(delivery, tapTwice)} `}
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
          placement={scoring.status === 'off' ? null : (scoring.scores?.stages[stage.slug] ?? null)}
          board={board}
          uid={scoring.user?.uid ?? null}
          saving={scoring.status === 'failed' ? 'failed' : saving}
          signedUp={scoring.signedUp}
          onPickNickname={() => setNaming(true)}
          primaryRef={primaryAction}
          onTryAgain={() => setRun(r => r + 1)}
        />
      )}

      {naming && (
        <NicknameDialog
          initialValue=""
          subtitle="Shown on the Meteor Coins scores."
          onClose={() => setNaming(false)}
          onSave={scoring.setNickname}
        />
      )}

      {debug && game && <DebugReadout game={game} fpsRef={fpsRef} />}
    </div>
  )
}

/**
 * Whether the result earns the stage's "clear" line. On Comet Homecoming
 * finishing is a star, but the clear line is about the comet getting home.
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

/**
 * A phase's opening banner, under the HUD: which phase, what it plays
 * with, and what to do, in plain words.
 */
function PhaseBanner({
  number,
  of,
  name,
  tool,
  line,
  howTo,
}: {
  number: number
  of: number
  name: string
  tool?: string
  line: string
  howTo: string
}) {
  return (
    <div className="w-full max-w-md rounded-lg border border-white/20 bg-black/75 px-4 py-2.5 text-center">
      <p className="text-[11px] uppercase tracking-wide text-white/60">
        Phase {number} of {of}
      </p>
      <p className="text-lg font-bold leading-tight">{name}</p>
      {tool && <p className="text-xs text-white/70">{tool}</p>}
      <p className="mt-1 text-sm leading-snug">{line}</p>
      <p className="mt-0.5 text-xs leading-snug text-white/70">{howTo}</p>
    </div>
  )
}

/**
 * How far the stage's last-push object (the comet) has to go: a track
 * from where it started to the front edge, filling as it gets nearer, and
 * "Home!" once it's there. Reads the game a few times a second.
 */
function HomeMeter({ game }: { game: DropGame }) {
  const id = game.stage.lastPush?.object
  const puck = useMemo(() => game.engine.pucks.find(p => p.spec.id === id), [game, id])
  const startZ = useMemo(() => (puck?.active ? puck.body.translation().z : 0), [puck])
  const read = useCallback(() => {
    if (!puck?.active) return 1
    const z = puck.body.translation().z
    return Math.min(1, Math.max(0, (z - startZ) / (FIELD_FRONT_Z - startZ)))
  }, [puck, startZ])
  const [share, setShare] = useState(read)
  useEffect(() => {
    const tick = window.setInterval(() => setShare(read()), 250)
    return () => window.clearInterval(tick)
  }, [read])
  const home = !puck?.active
  const percent = Math.round(share * 100)
  return (
    <div
      className="text-center"
      role="meter"
      aria-label="The comet's way home"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={home ? 'Home' : `${percent}% of the way home`}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/60">Comet</div>
      <div className="text-sm font-bold leading-tight sm:text-base">
        {home ? 'Home!' : `${percent}%`}
      </div>
      <div
        aria-hidden
        className="mt-0.5 h-1.5 w-14 overflow-hidden rounded-full border border-white/40"
      >
        <div className="h-full bg-white" style={{ width: `${percent}%` }} />
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
  placement,
  board,
  uid,
  saving,
  signedUp,
  onPickNickname,
  primaryRef,
  onTryAgain,
}: {
  stage: StageDef
  state: GameState
  outcome: Outcome
  /** The player's standing on this stage's board; null while unknown or with no boards. */
  placement: Placement | null
  /** The board after this run's save, or null until it lands. */
  board: BoardView | null
  uid: string | null
  saving: Saving
  signedUp: boolean
  onPickNickname: () => void
  primaryRef: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>
  onTryAgain: () => void
}) {
  const [status, setStatus] = useState('')
  const following = nextPlayableAfter(stage) ?? nextStageAfter(stage)
  const canAdvance = outcome.stars >= 1 && following?.playable
  const big = headline(stage, state)
  const hasGutters = stage.table.chuteHalfWidth < FIELD_HALF_WIDTH
  // The run just took first place from someone: a new best that tops the
  // board, with at least one other player to top. Repeating a #1 isn't one.
  const topScore =
    saving === 'idle' && outcome.isNewBest && placement?.rank === 1 && placement.players >= 2

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
        {topScore && <TopScore />}
        {stage.rules.tempo && state.bestTempo >= stage.rules.tempo.max && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
            <span aria-hidden className="material-symbols-outlined text-[16px]">
              speed
            </span>
            Redline reached
          </p>
        )}
        {outcome.slowed && (
          <p className="mt-1 text-xs text-white/70">
            Played with Slower {deliveryName(deliveryOf(stage))}.
          </p>
        )}
        <p className="mt-2 text-sm italic text-white/90">
          {cleared(stage, state, outcome.stars) ? stage.voice.clear : stage.voice.miss}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {nextStarSentence(stage, state)}{' '}
          {outcome.isNewBest
            ? 'New personal best!'
            : !!outcome.best && `Your best: ${outcome.best}.`}
        </p>
        <div className="mt-2 min-h-5 text-sm text-white/80" aria-live="polite">
          {saving === 'saving' && <p className="text-white/60">Saving your score…</p>}
          {saving === 'failed' && (
            <p className="text-white/60">Couldn&apos;t save your score to the board.</p>
          )}
          {saving === 'idle' && placement && (
            <PlaceLine
              stage={stage}
              placement={placement}
              signedUp={signedUp}
              onPickNickname={onPickNickname}
            />
          )}
        </div>
        {saving === 'idle' && board && board.entries.length > 0 && (
          <div className="mt-3 text-left">
            <p className="mb-1 text-xs uppercase tracking-wide text-white/60">Top scores</p>
            <ScoreBoard stage={stage} view={board} uid={uid} limit={5} />
          </div>
        )}
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
          <div className="flex justify-center gap-6">
            <Link
              href="/meteor-coins"
              className="min-h-11 py-3 text-sm text-white/70 underline-offset-4 hover:underline"
            >
              Stage map
            </Link>
            <Link
              href={`/meteor-coins/${stage.slug}/scores`}
              className="min-h-11 py-3 text-sm text-white/70 underline-offset-4 hover:underline"
            >
              Scores
            </Link>
          </div>
        </div>
        <p className="mt-2 h-4 text-xs text-white/70" role="status">
          {status}
        </p>
      </section>
    </div>
  )
}

/**
 * The one flourish in the result panel: a gold badge and a single burst of
 * coin dots from it (interaction model 3). Under reduced motion the badge
 * stands still, and the dots don't appear.
 */
function TopScore() {
  const still = usePrefersReducedMotion()
  const dots = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const distance = 70 + (i % 3) * 18
    return {
      tx: `${Math.round(Math.cos(angle) * distance)}px`,
      ty: `${Math.round(Math.sin(angle) * distance)}px`,
      size: 6 + (i % 3) * 2,
    }
  })
  return (
    <div className="relative mt-3 flex justify-center" role="status">
      {!still && (
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
          {dots.map((d, i) => (
            <span
              key={i}
              className="absolute animate-particle-burst rounded-full"
              style={{
                width: d.size,
                height: d.size,
                marginLeft: -d.size / 2,
                marginTop: -d.size / 2,
                background: PALETTE.puck,
                ['--tx' as string]: d.tx,
                ['--ty' as string]: d.ty,
              }}
            />
          ))}
        </span>
      )}
      <p
        className="relative inline-flex items-center gap-1 rounded-full px-4 py-1 text-sm font-extrabold uppercase tracking-wider text-black"
        style={{ background: PALETTE.puck }}
      >
        <span aria-hidden className="material-symbols-outlined text-[18px]">
          workspace_premium
        </span>
        Top score on this stage
      </p>
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
