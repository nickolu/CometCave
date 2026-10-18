'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { GRAVITY, PHYSICS_STEP_S, type PuckShape } from '@/app/coin-pusher/lib/cabinet'
import {
  AimInput,
  Cabinet,
  CabinetCamera,
  type CabinetHandle,
  type CabinetStats,
  POOL_SIZE,
} from '@/app/coin-pusher/scene/Cabinet'
import { PALETTE } from '@/app/coin-pusher/scene/palette'

/**
 * Coin Pusher — physics test build.
 *
 * Session shape: open-ended tool (for now). This build exists to answer one
 * question: can a few hundred stacked pucks sit still and slide together on a
 * phone at a smooth frame rate? The readout top-right is the answer. Scoring,
 * the coin purse, prizes and the shared pact come after this passes.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */
export default function CoinPusherApp() {
  const [shape, setShape] = useState<PuckShape>('round')
  const [run, setRun] = useState(0)
  const cabinet = useRef<CabinetHandle>(null)
  const aimRef = useRef(0)
  const fpsRef = useRef(0)
  const [stats, setStats] = useState<CabinetStats & { fps: number }>({
    live: 0,
    asleep: 0,
    scored: 0,
    lost: 0,
    fps: 0,
  })

  const drop = useCallback((count = 1) => cabinet.current?.drop(count), [])
  const dropOne = useCallback(() => drop(1), [drop])

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = cabinet.current?.stats()
      if (s) setStats({ ...s, fps: fpsRef.current })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-40 bg-ds-background text-white">
      <Link
        href="/"
        aria-label="Return to the cave"
        className="absolute left-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ✕
      </Link>

      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            Loading…
          </div>
        }
      >
        <Canvas key={`${shape}-${run}`} dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 100 }}>
          <color attach="background" args={[PALETTE.background]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 10, 6]} intensity={1.6} />
          <directionalLight position={[-6, 4, -4]} intensity={0.4} />
          <CabinetCamera />
          <FpsMeter fpsRef={fpsRef} />
          <Physics timeStep={PHYSICS_STEP_S} gravity={[0, GRAVITY, 0]}>
            <Cabinet ref={cabinet} shape={shape} aimRef={aimRef} />
          </Physics>
          <AimInput aimRef={aimRef} onDrop={dropOne} />
        </Canvas>
      </Suspense>

      <div
        role="status"
        aria-live="off"
        className="pointer-events-none absolute right-2 top-2 z-50 rounded-md bg-black/60 px-3 py-2 font-mono text-xs leading-5"
      >
        <div>{stats.fps} fps</div>
        <div>
          {stats.live}/{POOL_SIZE} pucks · {stats.asleep} asleep
        </div>
        <div>
          {stats.scored} in chute · {stats.lost} in gutters
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-50 flex flex-wrap justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <HudButton onClick={() => drop(25)}>Drop 25</HudButton>
        <HudButton onClick={() => setShape(s => (s === 'round' ? 'square' : 'round'))}>
          {shape === 'round' ? 'Try square pucks' : 'Try round pucks'}
        </HudButton>
        <HudButton onClick={() => setRun(r => r + 1)}>Reset</HudButton>
      </div>

      <p className="sr-only">
        Tap or click the cabinet to drop a puck where you point. With a keyboard, use the left and
        right arrow keys to aim and Space to drop.
      </p>
    </div>
  )
}

function HudButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-md border border-white/20 bg-white/10 px-4 text-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
    </button>
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
