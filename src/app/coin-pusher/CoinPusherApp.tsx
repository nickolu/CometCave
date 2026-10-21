'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SLOW_SPEED } from '@/app/coin-pusher/lib/dropper'
import { initPhysics } from '@/app/coin-pusher/lib/engine'
import { DropGame, type GameEvent } from '@/app/coin-pusher/lib/game'
import { COIN_BUDGET, type GameState, bonusForStreak } from '@/app/coin-pusher/lib/rules'
import { PALETTE } from '@/app/coin-pusher/scene/palette'
import { CabinetCamera, Scene } from '@/app/coin-pusher/scene/Scene'

/**
 * Coin Pusher — Fifty Coins.
 *
 * Session shape: run-loop. Fifty coins, a fixed starting pile, a high score;
 * "Play again" is the next action. The arm swings on its own; a tap (or
 * Space) drops a coin from its tip. Drop through the moving ring for a
 * bonus that grows with your streak.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */

const BEST_KEY = 'coin-pusher:best'
const SLOW_KEY = 'coin-pusher:slow'

function readNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}

export default function CoinPusherApp() {
  const [game, setGame] = useState<DropGame | null>(null)
  const [run, setRun] = useState(0)
  const [state, setState] = useState<GameState | null>(null)
  // Saved values are read in initializers: they only appear once the physics
  // has loaded in the browser, so server and client markup never disagree.
  const [slow, setSlow] = useState(() => readNumber(SLOW_KEY) === 1)
  const [best, setBest] = useState(() => readNumber(BEST_KEY))
  const [isNewBest, setIsNewBest] = useState(false)
  const [popup, setPopup] = useState<{ id: number; text: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [debug] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  )
  const fpsRef = useRef(0)
  const playAgain = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    let created: DropGame | null = null
    initPhysics().then(() => {
      if (cancelled) return
      created = new DropGame()
      setGame(created)
      setState(created.state)
      setIsNewBest(false)
    })
    return () => {
      cancelled = true
      created?.dispose()
      setGame(null)
    }
  }, [run])

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
      setState(prev => {
        const next = game.state
        if (prev === next) return prev
        if (next.phase === 'over' && prev?.phase !== 'over') {
          setAnnounce(`Game over. Final score ${next.score}.`)
          if (next.score > readNumber(BEST_KEY)) {
            write(BEST_KEY, String(next.score))
            setBest(next.score)
            setIsNewBest(true)
          }
        }
        return next
      })
    },
    [game]
  )

  useEffect(() => {
    if (!popup) return
    const id = window.setTimeout(() => setPopup(null), 1400)
    return () => window.clearTimeout(id)
  }, [popup])

  useEffect(() => {
    if (state?.phase === 'over') playAgain.current?.focus()
  }, [state?.phase])

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
      write(SLOW_KEY, s ? '0' : '1')
      return !s
    })
  }

  const over = state?.phase === 'over'

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
          <Canvas key={run} dpr={[1, 2]} camera={{ fov: 48, near: 0.1, far: 100 }}>
            <color attach="background" args={[PALETTE.background]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 12, 8]} intensity={1.6} />
            <directionalLight position={[-6, 4, -4]} intensity={0.4} />
            <CabinetCamera />
            {debug && <FpsMeter fpsRef={fpsRef} />}
            <Scene game={game} onStep={onStep} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            Loading…
          </div>
        )}
      </div>

      {state && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-14">
          <div className="flex items-baseline gap-5 rounded-lg bg-black/50 px-4 py-2">
            <Stat label="Coins" value={state.coinsLeft} />
            <Stat label="Score" value={state.score} />
            {state.streak > 0 && (
              <div className="text-xs leading-tight text-white/80">
                Streak {state.streak}
                <br />
                next hit +{bonusForStreak(state.streak + 1)}
              </div>
            )}
          </div>
        </div>
      )}

      {popup && (
        <div
          key={popup.id}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 z-40 text-center text-2xl font-bold"
          style={{ color: PALETTE.ringHit }}
        >
          {popup.text}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {state && !over && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-end justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-white/70">
            {state.phase === 'ready' &&
              'Tap or press Space to drop a coin. Drop through the ring for bonus coins.'}
            {state.phase === 'settling' && 'Last coins settling…'}
          </p>
          <button
            type="button"
            aria-pressed={slow}
            onPointerDown={e => e.stopPropagation()}
            onClick={toggleSlow}
            className="pointer-events-auto min-h-11 shrink-0 rounded-md border border-white/20 bg-black/40 px-3 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {slow ? 'Normal speed' : 'Slower arm'}
          </button>
        </div>
      )}

      {over && state && (
        <ResultPanel
          state={state}
          best={best}
          isNewBest={isNewBest}
          playAgainRef={playAgain}
          onPlayAgain={() => setRun(r => r + 1)}
        />
      )}

      {debug && game && <DebugReadout game={game} fpsRef={fpsRef} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
    </div>
  )
}

function ResultPanel({
  state,
  best,
  isNewBest,
  playAgainRef,
  onPlayAgain,
}: {
  state: GameState
  best: number
  isNewBest: boolean
  playAgainRef: React.RefObject<HTMLButtonElement | null>
  onPlayAgain: () => void
}) {
  const [status, setStatus] = useState('')

  const share = async () => {
    const url = `${window.location.origin}/coin-pusher`
    const text = `I pushed ${state.score} coins into the chute from ${COIN_BUDGET} on Coin Pusher.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Coin Pusher', text, url })
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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section
        aria-labelledby="result-heading"
        className="w-full max-w-sm rounded-xl border border-white/15 bg-ds-background p-6 text-center"
      >
        <h2 id="result-heading" className="text-sm uppercase tracking-wide text-white/60">
          Final score
        </h2>
        <p className="mt-1 text-6xl font-extrabold tabular-nums">{state.score}</p>
        <p className="mt-1 text-sm text-white/70">coins into the chute from {COIN_BUDGET}</p>
        <p className="mt-3 text-sm text-white/80">
          {isNewBest ? 'New personal best!' : `Your best: ${best}`}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
          <div>
            <dt>Ring hits</dt>
            <dd className="text-base font-semibold text-white">
              {state.hits}/{state.shots}
            </dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd className="text-base font-semibold text-white">{state.bestStreak}</dd>
          </div>
          <div>
            <dt>Gutters</dt>
            <dd className="text-base font-semibold text-white">{state.lost}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={share}
            className="min-h-11 rounded-md border border-white/25 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Share score
          </button>
          <button
            ref={playAgainRef}
            type="button"
            onClick={onPlayAgain}
            className="min-h-11 rounded-md bg-ds-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Play again
          </button>
          <Link
            href="/"
            className="min-h-11 py-3 text-sm text-white/70 underline-offset-4 hover:underline"
          >
            Return to the cave
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
      setText(`${fpsRef.current} fps · ${live} live · ${asleep} asleep`)
    }, 250)
    return () => window.clearInterval(id)
  }, [game, fpsRef])
  return (
    <div className="pointer-events-none absolute bottom-20 right-2 z-50 rounded bg-black/60 px-2 py-1 font-mono text-xs">
      {text}
    </div>
  )
}
