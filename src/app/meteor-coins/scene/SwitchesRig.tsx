'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  FIELD_HALF_WIDTH,
  PUSHER_HEIGHT,
  deckFaceZ,
  deckStroke,
} from '@/app/meteor-coins/lib/cabinet'
import type { Vec } from '@/app/meteor-coins/lib/cannon'
import {
  BAR,
  PLATE_RESET_S,
  type SwitchesDelivery,
  type Track,
  laneX,
  trackKey,
  trackPoints,
} from '@/app/meteor-coins/lib/deliveries/switches'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

const TUBE_RADIUS = 0.3
const COIN_RADIUS = 0.24
/** Plates are a lane wide, less a margin, and long enough to cover the pusher top the deck above spills onto. */
const PLATE_WIDTH = (FIELD_HALF_WIDTH * 2) / 3 - 0.3
const PLATE_LENGTH = 2.3
const MAX_ROLLING = 4

/**
 * The player's reduced-motion setting, read live each frame: decorative
 * pulsing and easing stop while it's on.
 */
function useReducedMotion(): { readonly matches: boolean } {
  return useMemo(
    () =>
      typeof window === 'undefined'
        ? { matches: false }
        : window.matchMedia('(prefers-reduced-motion: reduce)'),
    []
  )
}

/** Every length of tube in the network, keyed by where it starts and what it runs into. */
function allTracks(d: SwitchesDelivery): { key: string; from: Vec; track: Track }[] {
  const c = d.config
  return [
    { key: trackKey(null), from: c.hopper, track: c.first },
    ...c.junctions.flatMap((j, i) => [
      { key: trackKey(i, 'left'), from: j.at, track: j.left },
      { key: trackKey(i, 'right'), from: j.at, track: j.right },
    ]),
  ]
}

function tubeGeometry(points: Vec[]): THREE.TubeGeometry {
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    path.add(
      new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z))
    )
  }
  return new THREE.TubeGeometry(path, 24 * (points.length - 1), TUBE_RADIUS, 12, false)
}

/**
 * The Cascade Engine's track switches and its chain reactions: the hopper,
 * the glass tubes (the route a coin sent now would take is lit, and an
 * arrow points down from its spout), each junction's paddle pointing the
 * way it's set, the coins rolling down, the gold and red plates on the
 * lower pushers, the bars across the lips, and the bonus hopper. Reads the
 * game every frame; owns no state of its own.
 */
export function SwitchesRig({ game, switches: d }: { game: DropGame; switches: SwitchesDelivery }) {
  const c = d.config
  const motion = useReducedMotion()
  const tracks = useMemo(
    () =>
      allTracks(d).map(t => ({
        ...t,
        geometry: tubeGeometry(trackPoints(c, t.from, t.track)),
      })),
    [d, c]
  )
  const tubeMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const paddles = useRef<(THREE.Group | null)[]>([])
  const selectRing = useRef<THREE.Mesh>(null)
  const arrow = useRef<THREE.Group>(null)
  const nextCoin = useRef<THREE.Mesh>(null)
  const coins = useRef<(THREE.Mesh | null)[]>([])
  const plates = useRef<{ gold: THREE.Group | null; red: THREE.Group | null }[]>([])
  const plateMats = useRef<
    { gold: THREE.MeshStandardMaterial | null; red: THREE.MeshStandardMaterial | null }[]
  >([])
  const pips = useRef<{ gold: (THREE.Mesh | null)[]; red: (THREE.Mesh | null)[] }[]>([])
  const bars = useRef<(THREE.Group | null)[]>([])
  const gate = useRef<THREE.Group>(null)
  const icons = useMemo(() => ({ gold: plateTexture('gold'), red: plateTexture('red') }), [])
  const stripes = useMemo(() => stripeTexture(), [])
  /** Where each plate is drawn across the deck, eased toward its lane when the plates move. */
  const drawnX = useRef<{ gold: number; red: number }[]>([])

  useFrame((_, delta) => {
    const reduced = motion.matches
    const route = d.route()
    const lit = new Set(route.tracks)
    tracks.forEach((t, i) => {
      const mat = tubeMats.current[i]
      if (!mat) return
      const on = lit.has(t.key)
      mat.color.set(on ? PALETTE.tubeLit : PALETTE.tube)
      mat.emissive.set(on ? PALETTE.tubeLit : PALETTE.tube)
      mat.emissiveIntensity = on ? 0.7 : 0.02
      mat.opacity = on ? 0.7 : 0.14
    })
    d.ways.forEach((way, i) => {
      paddles.current[i]?.rotation.set(0, 0, way === 'left' ? 0.7 : -0.7)
    })
    const sel = c.junctions[d.selected]
    if (selectRing.current) {
      selectRing.current.visible = d.keyboard
      selectRing.current.position.set(sel.at.x, sel.at.y, sel.at.z + 0.32)
    }
    const exit = c.exits[route.exit].at
    if (arrow.current) {
      arrow.current.position.set(exit.x, exit.y - 0.25, exit.z)
      arrow.current.visible = d.ready
      const bob = reduced ? 0 : 0.08 * Math.sin(game.engine.time * 5)
      arrow.current.position.y += bob
    }
    if (nextCoin.current) nextCoin.current.visible = d.ready
    for (let i = 0; i < MAX_ROLLING; i++) {
      const mesh = coins.current[i]
      const coin = d.rolling[i]
      if (!mesh) continue
      mesh.visible = coin !== undefined
      if (coin) mesh.position.set(coin.at.x, coin.at.y, coin.at.z)
    }

    const layout = game.engine.layout
    const now = game.engine.time
    c.plates.decks.forEach((pd, i) => {
      const deck = layout[pd.deck]
      const face = deckFaceZ(deck, deckStroke(deck, now, game.engine.pusherPeriodS))
      const lanes = d.plateLanes(i)
      const state = d.plates[i]
      const drawn = (drawnX.current[i] ??= { gold: laneX(lanes.gold), red: laneX(lanes.red) })
      const ease = reduced ? 1 : Math.min(1, delta * 4)
      const resetting = state.tripped !== null && now - state.tripped.at < PLATE_RESET_S
      for (const kind of ['gold', 'red'] as const) {
        drawn[kind] += (laneX(lanes[kind]) - drawn[kind]) * ease
        const group = plates.current[i]?.[kind]
        group?.position.set(
          drawn[kind],
          deck.floorY + PUSHER_HEIGHT + 0.012,
          face - PLATE_LENGTH / 2
        )
        const mat = plateMats.current[i]?.[kind]
        if (mat) {
          const fill = state[kind] / (kind === 'gold' ? c.plates.goldCoins : c.plates.redCoins)
          const justTripped = state.tripped?.plate === kind && resetting
          // A flash when it trips; otherwise it glows brighter as it fills.
          const pulse = reduced ? 0 : 0.15 * Math.sin(now * 6)
          mat.emissiveIntensity = justTripped
            ? 1.2
            : resetting
              ? 0.05
              : 0.25 + 0.6 * fill + pulse * fill
        }
        const coinsNeeded = kind === 'gold' ? c.plates.goldCoins : c.plates.redCoins
        pips.current[i]?.[kind].forEach((pip, k) => {
          if (pip) pip.visible = !resetting && state[kind] > k + 0.25 && k < coinsNeeded
        })
      }
      const bar = bars.current[i]
      if (bar) {
        const p = d.bars[i].body.translation()
        bar.position.set(p.x, p.y, p.z)
        bar.visible = d.bars[i].raised > 0
      }
    })
    if (gate.current) gate.current.rotation.x = d.gate * 1.2
  })

  const pips3 = (n: number) => Array.from({ length: Math.ceil(n) }, (_, k) => k)
  const pour = c.bonusPour
  return (
    <>
      {/* The hopper, with the next coin waiting at its mouth. */}
      <mesh position={[c.hopper.x, c.hopper.y + 0.35, c.hopper.z]}>
        <cylinderGeometry args={[0.7, 0.32, 0.7, 20, 1, true]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          metalness={0.6}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={nextCoin}
        position={[c.hopper.x, c.hopper.y + 0.2, c.hopper.z]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[COIN_RADIUS, COIN_RADIUS, 0.08, 20]} />
        <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
      </mesh>
      {tracks.map((t, i) => (
        <mesh key={t.key} geometry={t.geometry}>
          <meshStandardMaterial
            ref={m => {
              tubeMats.current[i] = m
            }}
            color={PALETTE.tube}
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Junctions: a brass hub with a paddle leaning the way the coin will go. */}
      {c.junctions.map((j, i) => (
        <group key={i} position={[j.at.x, j.at.y, j.at.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.5, 24]} />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.35} />
          </mesh>
          <group
            ref={g => {
              paddles.current[i] = g
            }}
            position={[0, 0, 0.3]}
          >
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.14, 0.6, 0.06]} />
              <meshBasicMaterial color={PALETTE.tubeLit} />
            </mesh>
            <mesh position={[0, -0.62, 0]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.16, 0.22, 3]} />
              <meshBasicMaterial color={PALETTE.tubeLit} />
            </mesh>
          </group>
        </group>
      ))}
      {/* The junction the arrow keys work on, once they've been used. */}
      <mesh ref={selectRing} visible={false}>
        <torusGeometry args={[0.62, 0.05, 8, 32]} />
        <meshBasicMaterial color={PALETTE.cue} />
      </mesh>
      {/* An arrow down from the lit route's spout: where the next coin drops. */}
      <group ref={arrow}>
        <mesh position={[0, -0.25, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.22, 0.35, 4]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
      </group>
      {Array.from({ length: MAX_ROLLING }, (_, i) => (
        <mesh
          key={i}
          ref={m => {
            coins.current[i] = m
          }}
          visible={false}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[COIN_RADIUS, COIN_RADIUS, 0.1, 20]} />
          <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
        </mesh>
      ))}

      {/* Gold and red plates on each lower pusher, under the lip of the deck above. */}
      {c.plates.decks.map((pd, i) => (
        <group key={pd.deck}>
          {(['gold', 'red'] as const).map(kind => (
            <group
              key={kind}
              ref={g => {
                plates.current[i] ??= { gold: null, red: null }
                plates.current[i][kind] = g
              }}
            >
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[PLATE_WIDTH, PLATE_LENGTH]} />
                <meshStandardMaterial
                  ref={m => {
                    plateMats.current[i] ??= { gold: null, red: null }
                    plateMats.current[i][kind] = m
                  }}
                  map={icons[kind]}
                  color={kind === 'gold' ? PALETTE.plateGold : PALETTE.plateRed}
                  emissive={kind === 'gold' ? PALETTE.plateGold : PALETTE.plateRed}
                  emissiveIntensity={0.3}
                  transparent
                  polygonOffset
                  polygonOffsetFactor={-2}
                />
              </mesh>
              {/* One pip per coin it takes, lit as they land. */}
              {pips3(kind === 'gold' ? c.plates.goldCoins : c.plates.redCoins).map(k => (
                <mesh
                  key={k}
                  ref={m => {
                    pips.current[i] ??= { gold: [], red: [] }
                    pips.current[i][kind][k] = m
                  }}
                  position={[(k - 1) * 0.4, 0.03, PLATE_LENGTH / 2 - 0.25]}
                  visible={false}
                >
                  <sphereGeometry args={[0.11, 10, 8]} />
                  <meshBasicMaterial color={PALETTE.tubeLit} />
                </mesh>
              ))}
            </group>
          ))}
          {/* The bar a red plate raises across this deck's lip. */}
          <group
            ref={g => {
              bars.current[i] = g
            }}
            visible={false}
          >
            <mesh>
              <boxGeometry args={[c.plates.barHalfWidth * 2, BAR.height, BAR.depth]} />
              <meshStandardMaterial color={PALETTE.plateRed} map={stripes} />
            </mesh>
          </group>
        </group>
      ))}

      {/* The bonus hopper: a glass trough of coins, its gate swinging open on gold. */}
      <group position={[0, pour.y + 0.25, pour.z]}>
        <mesh>
          <boxGeometry args={[pour.halfWidth * 2 + 0.8, 0.4, 0.6]} />
          <meshStandardMaterial color={PALETTE.tube} transparent opacity={0.2} depthWrite={false} />
        </mesh>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh
            key={k}
            position={[(k - 4) * 0.62, -0.08 + (k % 2) * 0.06, 0]}
            rotation={[0.3 * ((k % 3) - 1), 0, 0.2 * ((k % 2) - 0.5)]}
          >
            <cylinderGeometry args={[0.28, 0.28, 0.08, 16]} />
            <meshStandardMaterial color={PALETTE.plateGold} metalness={0.4} roughness={0.45} />
          </mesh>
        ))}
        <group ref={gate} position={[0, -0.2, 0.3]}>
          <mesh position={[0, 0, -0.3]}>
            <boxGeometry args={[pour.halfWidth * 2 + 0.8, 0.05, 0.6]} />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </>
  )
}

/**
 * A plate's face, drawn on a canvas: a star on gold, a crossed bar on red,
 * so the two read apart without their colours.
 */
function plateTexture(kind: 'gold' | 'red'): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = PALETTE.plateMark
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 236, 236)
    ctx.fillStyle = PALETTE.plateMark
    ctx.strokeStyle = PALETTE.plateMark
    if (kind === 'gold') {
      ctx.beginPath()
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 80 : 34
        const a = -Math.PI / 2 + (k * Math.PI) / 5
        ctx.lineTo(128 + r * Math.cos(a), 128 + r * Math.sin(a))
      }
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.lineWidth = 26
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(64, 64)
      ctx.lineTo(192, 192)
      ctx.moveTo(192, 64)
      ctx.lineTo(64, 192)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Hazard stripes for the bar. */
function stripeTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.plateRed
    ctx.fillRect(0, 0, 256, 32)
    ctx.fillStyle = PALETTE.barStripe
    for (let x = -32; x < 256; x += 32) {
      ctx.beginPath()
      ctx.moveTo(x, 32)
      ctx.lineTo(x + 16, 32)
      ctx.lineTo(x + 32, 0)
      ctx.lineTo(x + 16, 0)
      ctx.closePath()
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(3, 1)
  return texture
}
