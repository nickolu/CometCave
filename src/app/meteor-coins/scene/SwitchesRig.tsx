'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
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
  HOPPER,
  PLATE_HOLD_S,
  PLATE_RESET_S,
  type SwitchesDelivery,
  type Track,
  laneX,
  trackKey,
  trackPoints,
} from '@/app/meteor-coins/lib/deliveries/switches'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

const TUBE_RADIUS = 0.26
const COIN_RADIUS = 0.24
/** Plates are a lane wide, less a margin, and long enough to cover the pusher top the deck above spills onto. */
const PLATE_WIDTH = (FIELD_HALF_WIDTH * 2) / 3 - 0.3
const PLATE_LENGTH = 2.3
const MAX_ROLLING = 4
/**
 * Each plate's sign, in units and canvas pixels. Sized so the "+16" on the
 * middle step's reads at about 14px on a 390px-wide phone.
 */
const SIGN = { w: 1.8, h: 1.2, px: 300, py: 200 }
/** The sign floats this high over the pusher top, this far in front of the lip above. */
const SIGN_AT = { above: 0.95, ahead: HOPPER.ahead + 0.45 }
/** Seconds a plate takes to slide to its new lane. */
const SLIDE_S = PLATE_RESET_S - PLATE_HOLD_S

type Kind = 'gold' | 'red'
const KINDS = ['gold', 'red'] as const

/**
 * The player's reduced-motion setting, read live each frame: decorative
 * bobbing and easing stop while it's on.
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
  return new THREE.TubeGeometry(path, 24 * (points.length - 1), TUBE_RADIUS, 10, false)
}

/** Which way a coin leaves a junction down each branch: toward the branch's first point. */
function branchDirections(
  d: SwitchesDelivery
): { left: THREE.Quaternion; right: THREE.Quaternion }[] {
  const up = new THREE.Vector3(0, 1, 0)
  const toward = (from: Vec, track: Track) => {
    const next = trackPoints(d.config, from, track)[1]
    const dir = new THREE.Vector3(next.x - from.x, next.y - from.y, next.z - from.z).normalize()
    return new THREE.Quaternion().setFromUnitVectors(up, dir)
  }
  return d.config.junctions.map(j => ({ left: toward(j.at, j.left), right: toward(j.at, j.right) }))
}

/**
 * A plate's sign, drawn on a canvas and redrawn only when what it shows
 * changes: gold shows its hopper's payout, red a little bar like the one it
 * raises, and both a row of pips, one per coin it needs, that fill as
 * coins land and empty as they drain.
 */
class Sign {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private shown = ''

  constructor(
    readonly kind: Kind,
    readonly need: number,
    readonly bonus: number
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = SIGN.px
    this.canvas.height = SIGN.py
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
  }

  /** Shows `fill` coins of `need` (a fraction drawn as part of a pip), dimmed while it moves. */
  show(fill: number, dark: boolean) {
    const key = `${Math.round(fill * 12)}|${dark}`
    if (key === this.shown) return
    this.shown = key
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const { px: w, py: h } = SIGN
    const gold = this.kind === 'gold'
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = dark ? 0.45 : 1
    // The plate's own colour, edged dark so it reads against coins.
    ctx.fillStyle = gold ? PALETTE.plateGold : PALETTE.plateRed
    ctx.strokeStyle = PALETTE.plateMark
    ctx.lineWidth = 10
    roundRect(ctx, 6, 6, w - 12, h - 12, 26)
    ctx.fill()
    ctx.stroke()
    const ink = gold ? PALETTE.plateMark : PALETTE.barStripe
    if (gold) {
      // A star, as on the plate, and what its hopper pours.
      star(ctx, 66, 72, 40, PALETTE.plateMark)
      ctx.fillStyle = ink
      ctx.font = 'bold 84px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`+${this.bonus}`, 190, 76)
    } else {
      // The bar it raises, striped as the real one, crossed as the plate.
      stripes(ctx, 30, 42, w - 60, 56)
      ctx.strokeStyle = PALETTE.plateMark
      ctx.lineWidth = 18
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(w / 2 - 34, 36)
      ctx.lineTo(w / 2 + 34, 104)
      ctx.moveTo(w / 2 + 34, 36)
      ctx.lineTo(w / 2 - 34, 104)
      ctx.stroke()
    }
    // One pip per coin it needs: filled as they land, a slice as one drains.
    const r = Math.min(26, (w - 40) / this.need / 2 - 4)
    const gap = (w - 40) / this.need
    for (let k = 0; k < this.need; k++) {
      const cx = 20 + gap * (k + 0.5)
      const cy = 148
      const part = Math.max(0, Math.min(1, fill - k))
      ctx.fillStyle = gold ? PALETTE.plateGold : PALETTE.plateRed
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      if (part > 0) {
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + part * Math.PI * 2)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = ink
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 === 0 ? r : r * 0.42
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
  }
  ctx.closePath()
  ctx.fill()
}

function stripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = PALETTE.plateRed
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = PALETTE.barStripe
  for (let sx = x - h; sx < x + w; sx += h) {
    ctx.beginPath()
    ctx.moveTo(sx, y + h)
    ctx.lineTo(sx + h / 2, y + h)
    ctx.lineTo(sx + h, y)
    ctx.lineTo(sx + h / 2, y)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = PALETTE.plateMark
  ctx.lineWidth = 5
  ctx.strokeRect(x, y, w, h)
}

/**
 * The Cascade Engine's track switches and its plates: the hopper, the glass
 * tubes (the route a coin sent now would take is lit, down to a beam from
 * its spout to where it lands), each junction's arrow pointing the way it's
 * set, the coins rolling down, the gold and red plates on the lower
 * pushers with a sign over each (gold's hanging hopper and payout, red's
 * little bar, and pips for how full each is), the bars sunk in each step's
 * lip, which peek up as red fills. Reads the game every frame; owns no
 * game state of its own.
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
  const turns = useMemo(() => branchDirections(d), [d])
  const tubeMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const arrows = useRef<(THREE.Group | null)[]>([])
  const arrowMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const selectRing = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Group>(null)
  const nextCoin = useRef<THREE.Mesh>(null)
  const coins = useRef<(THREE.Mesh | null)[]>([])
  const plates = useRef<{ gold: THREE.Group | null; red: THREE.Group | null }[]>([])
  const plateMats = useRef<
    { gold: THREE.MeshStandardMaterial | null; red: THREE.MeshStandardMaterial | null }[]
  >([])
  const signGroups = useRef<{ gold: THREE.Group | null; red: THREE.Group | null }[]>([])
  const hoppers = useRef<(THREE.Group | null)[]>([])
  const hopperCoins = useRef<(THREE.Group | null)[]>([])
  const bars = useRef<(THREE.Group | null)[]>([])
  const icons = useMemo(() => ({ gold: plateTexture('gold'), red: plateTexture('red') }), [])
  const barStripes = useMemo(() => stripeTexture(), [])
  const signs = useMemo(
    () =>
      c.plates.decks.map(() => ({
        gold: new Sign('gold', c.plates.goldCoins, c.plates.bonus),
        red: new Sign('red', c.plates.redCoins, 0),
      })),
    [c]
  )
  useEffect(() => () => signs.forEach(s => KINDS.forEach(k => s[k].dispose())), [signs])
  /** Where each plate is drawn across the deck, eased toward its lane when the plates move. */
  const drawnX = useRef<{ gold: number; red: number }[]>([])

  useFrame((state, delta) => {
    const reduced = motion.matches
    const now = game.engine.time
    const route = d.route()
    const lit = new Set(route.tracks)
    tracks.forEach((t, i) => {
      const mat = tubeMats.current[i]
      if (!mat) return
      const on = lit.has(t.key)
      mat.color.set(on ? PALETTE.tubeLit : PALETTE.tube)
      mat.emissive.set(on ? PALETTE.tubeLit : PALETTE.tube)
      mat.emissiveIntensity = on ? 0.7 : 0.02
      mat.opacity = on ? 0.75 : 0.16
    })
    const onRoute = new Set(route.junctions)
    d.ways.forEach((way, i) => {
      arrows.current[i]?.quaternion.copy(turns[i][way])
      arrowMats.current[i]?.color.set(onRoute.has(i) ? PALETTE.tubeLit : PALETTE.tube)
    })
    const sel = c.junctions[d.selected]
    if (selectRing.current) {
      selectRing.current.visible = d.keyboard
      selectRing.current.position.set(sel.at.x, sel.at.y, sel.at.z)
      selectRing.current.quaternion.copy(state.camera.quaternion)
    }
    // A beam from the lit spout down to where the coin will land.
    const exit = c.exits[route.exit]
    if (beam.current) {
      const deck = game.engine.layout[exit.deck]
      const floor = deck.floorY + (exit.deck === 2 ? 0 : PUSHER_HEIGHT)
      const length = exit.at.y - floor
      beam.current.position.set(exit.at.x, floor, exit.at.z)
      beam.current.scale.set(1, length, 1)
      beam.current.visible = d.ready
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
    c.plates.decks.forEach((pd, i) => {
      const deck = layout[pd.deck]
      const top = deck.floorY + PUSHER_HEIGHT
      const face = deckFaceZ(deck, deckStroke(deck, now, game.engine.pusherPeriodS))
      const st = d.plates[i]
      const lanes = d.plateLanes(i)
      const since = st.tripped ? now - st.tripped.at : Infinity
      const resetting = since < PLATE_RESET_S
      const drawn = (drawnX.current[i] ??= { gold: laneX(lanes.gold), red: laneX(lanes.red) })
      for (const kind of KINDS) {
        const fired = st.tripped?.plate === kind && resetting
        // The plate that went off holds still while its effect plays, then slides over.
        const target = fired && since < PLATE_HOLD_S ? laneX(st.tripped!.lane) : laneX(lanes[kind])
        const ease = reduced ? 1 : Math.min(1, (delta * 5) / SLIDE_S)
        drawn[kind] += (target - drawn[kind]) * ease
        plates.current[i]?.[kind]?.position.set(drawn[kind], top + 0.012, face - PLATE_LENGTH / 2)
        const mat = plateMats.current[i]?.[kind]
        const need = kind === 'gold' ? c.plates.goldCoins : c.plates.redCoins
        const fill = st[kind] / need
        if (mat) {
          // A flash when it goes off; otherwise brighter as it fills.
          const pulse = reduced ? 0 : 0.15 * Math.sin(now * 6)
          mat.emissiveIntensity = fired ? 1.2 : resetting ? 0.05 : 0.25 + 0.6 * fill + pulse * fill
        }
        // The sign over the plate: always facing the player.
        const sign = signGroups.current[i]?.[kind]
        if (sign) {
          sign.position.set(drawn[kind], top + SIGN_AT.above, deck.backZ + SIGN_AT.ahead)
          sign.quaternion.copy(state.camera.quaternion)
          // It hops when it goes off, so the eye goes to it.
          const hop = fired && !reduced ? 0.25 * Math.sin(Math.min(1, since / 0.4) * Math.PI) : 0
          sign.position.y += hop
        }
        signs[i][kind].show(fired ? need : resetting ? 0 : st[kind], resetting && !fired)
      }
      // Gold's hopper hangs over its plate; it tips and empties when the plate goes off.
      const hopper = hoppers.current[i]
      if (hopper) {
        hopper.position.set(drawn.gold, top + HOPPER.above + 0.45, deck.backZ + HOPPER.ahead)
        const pouring = st.tripped?.plate === 'gold' && since < PLATE_RESET_S
        const tip = pouring ? Math.sin(Math.min(1, since / 0.3) * (Math.PI / 2)) : 0
        hopper.rotation.z = (reduced ? 0.5 : 0.9) * tip
        const full = hopperCoins.current[i]
        if (full) full.visible = !pouring || since < 0.2
      }
      // The bar sits sunk in the lip, its top showing; it peeks up as red fills.
      const bar = bars.current[i]
      if (bar) {
        const p = d.bars[i].body.translation()
        const peek = resetting ? 0 : (BAR.height * 0.3 * st.red) / c.plates.redCoins
        bar.position.set(p.x, Math.max(p.y, deck.floorY - BAR.height / 2 + 0.03 + peek), p.z)
      }
    })
  })

  const pin = (n: number) => Array.from({ length: n }, (_, k) => k)
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
            opacity={0.16}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Junctions: a brass ball with an arrow out of it, along the tube the coin will take. */}
      {c.junctions.map((j, i) => (
        <group key={i} position={[j.at.x, j.at.y, j.at.z]}>
          <mesh>
            <sphereGeometry args={[0.36, 20, 14]} />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.35} />
          </mesh>
          <group
            ref={g => {
              arrows.current[i] = g
            }}
          >
            <mesh position={[0, 0.42, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.4, 8]} />
              <meshBasicMaterial
                ref={m => {
                  arrowMats.current[i] = m
                }}
                color={PALETTE.tubeLit}
              />
            </mesh>
            <mesh position={[0, 0.72, 0]}>
              <coneGeometry args={[0.2, 0.3, 12]} />
              <meshBasicMaterial color={PALETTE.tubeLit} />
            </mesh>
          </group>
        </group>
      ))}
      {/* The junction the arrow keys work on, once they've been used. */}
      <mesh ref={selectRing} visible={false}>
        <torusGeometry args={[0.6, 0.06, 8, 32]} />
        <meshBasicMaterial color={PALETTE.cue} depthTest={false} />
      </mesh>
      {/* A beam from the lit spout to where the next coin lands, and an arrow at its foot. */}
      <group ref={beam}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 1, 8, 1, true]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      {pin(MAX_ROLLING).map(i => (
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

      {c.plates.decks.map((pd, i) => (
        <group key={pd.deck}>
          {KINDS.map(kind => (
            <group key={kind}>
              {/* The plate on the pusher top, under the lip of the step above. */}
              <group
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
              </group>
              {/* Its sign, floating over it. */}
              <group
                ref={g => {
                  signGroups.current[i] ??= { gold: null, red: null }
                  signGroups.current[i][kind] = g
                }}
              >
                {/* Drawn over everything: a heap of coins under a tube can rise into it. */}
                <mesh renderOrder={3}>
                  <planeGeometry args={[SIGN.w, SIGN.h]} />
                  <meshBasicMaterial
                    map={signs[i][kind].texture}
                    transparent
                    depthTest={false}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            </group>
          ))}
          {/* Gold's bonus hopper, full of coins, hanging over the plate. */}
          <group
            ref={g => {
              hoppers.current[i] = g
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.55, 0.2, 0.55, 20, 1, true]} />
              <meshStandardMaterial
                color={PALETTE.brass}
                metalness={0.6}
                roughness={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
            <group
              ref={g => {
                hopperCoins.current[i] = g
              }}
            >
              {pin(5).map(k => (
                <mesh
                  key={k}
                  position={[(k - 2) * 0.17, 0.2 + (k % 2) * 0.06, ((k % 3) - 1) * 0.12]}
                  rotation={[0.3 * ((k % 3) - 1), 0, 0.25 * ((k % 2) - 0.5)]}
                >
                  <cylinderGeometry args={[0.2, 0.2, 0.06, 14]} />
                  <meshStandardMaterial
                    color={PALETTE.plateGold}
                    metalness={0.4}
                    roughness={0.45}
                  />
                </mesh>
              ))}
            </group>
          </group>
          {/* The bar a red plate raises across this step's lip, sunk until then. */}
          <group
            ref={g => {
              bars.current[i] = g
            }}
          >
            <mesh>
              <boxGeometry args={[c.plates.barHalfWidth * 2, BAR.height, BAR.depth]} />
              <meshStandardMaterial color={PALETTE.plateRed} map={barStripes} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  )
}

/**
 * A plate's face, drawn on a canvas: a star on gold, a cross on red, so the
 * two read apart without their colours.
 */
function plateTexture(kind: Kind): THREE.Texture {
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
    if (kind === 'gold') {
      star(ctx, 128, 128, 80, PALETTE.plateMark)
    } else {
      ctx.strokeStyle = PALETTE.plateMark
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
  if (ctx) stripes(ctx, 0, 0, 256, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(3, 1)
  return texture
}
