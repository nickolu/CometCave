'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { BACK_WALL_Z, PUCK_RADIUS, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import {
  BALL_RADIUS,
  BAR_DEPTH,
  BAR_HEIGHT,
  type BowlingDelivery,
  GUTTER_WIDTH,
  KICKBACK_HEIGHT,
  KICKBACK_LEAD,
  LIFT_HEIGHT,
  SIGN_TOP,
  aimDirection,
} from '@/app/meteor-coins/lib/deliveries/bowling'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** The aim line: a dot this far apart, from the ball to the end of the deck. */
const DOT_STEP = 0.32
const MAX_DOTS = 40
/** Stars flecked into the lane's polish. */
const STARS = 46
/** How long the sign shows the last ball's call before going back to the frame. */
const CALL_S = 2.4
/** The strength gauge beside the ball: its height. */
const GAUGE_H = 1.3
/** The sign: from this far above the lane up to SIGN_TOP, hung just in front of the back wall. */
const SIGN_BOTTOM = 0.6
const SIGN_Z = BACK_WALL_Z + 0.08

/**
 * Moonlight Lanes' alley: the polished midnight lane flecked with stars,
 * its gold aiming arrows and foul line, gutters, the pin deck with its pin
 * spots and kickbacks, and the scoreboard sign over the pit. While the ball
 * waits it draws the aim (a dotted line up the lane, where the ball will
 * roll) and, while a throw is being lined up, a strength gauge beside the
 * ball that fills as the swipe lengthens or the meter rises. During a reset
 * it draws the pinsetter's plate holding the standing pins up and the bar
 * sweeping the deck. Reads the game every frame; owns no state of its own.
 */
export function BowlingRig({ game, lanes }: { game: DropGame; lanes: BowlingDelivery }) {
  const c = lanes.config
  const dots = useRef<THREE.InstancedMesh>(null)
  const dotMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const gauge = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Mesh>(null)
  const plate = useRef<THREE.Mesh>(null)
  const sign = useMemo(() => new SignPainter(), [])
  useEffect(() => () => sign.dispose(), [sign])
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) }),
    []
  )

  const length = c.frontZ - c.endZ
  const midZ = c.endZ + length / 2
  const kickFrom = c.headZ + KICKBACK_LEAD
  const pinTop = c.pinCoins * PUCK_THICKNESS

  useFrame(() => {
    const engine = game.engine
    const waiting = lanes.phase === 'ready' && game.canDrop
    const { aim, power } = lanes.preview
    // The aim line: straight up the lane from the ball (it has no spin to
    // curve it), to the deck's end or the edge of the lane.
    const mesh = dots.current
    if (mesh) {
      const d = aimDirection(aim)
      for (let i = 0; i < MAX_DOTS; i++) {
        const s = BALL_RADIUS + 0.2 + i * DOT_STEP
        const x = d.x * s
        const z = c.ballZ + d.z * s
        const on = waiting && z > c.endZ && Math.abs(x) < c.halfWidth
        mesh.setMatrixAt(i, on ? scratch.m.makeTranslation(x, c.y + 0.02, z) : scratch.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    // Brighter while a throw is being lined up.
    if (dotMaterial.current) dotMaterial.current.opacity = power === null ? 0.45 : 0.95
    if (gauge.current) gauge.current.visible = waiting && power !== null
    if (fill.current) {
      const p = Math.max(0.02, power ?? 0)
      fill.current.scale.set(1, p, 1)
      fill.current.position.y = (GAUGE_H * p) / 2
    }
    const sweepZ = lanes.sweepZ
    if (bar.current) {
      bar.current.visible = sweepZ !== null
      bar.current.position.set(0, c.y + BAR_HEIGHT / 2 + 0.01, sweepZ ?? c.headZ)
    }
    if (plate.current) {
      const lift = lanes.lift
      plate.current.visible = lift > 0
      plate.current.position.y = c.y + lift * LIFT_HEIGHT + pinTop + 0.06
    }
    const recent = engine.time - lanes.lastCallAt < CALL_S ? lanes.lastCall : null
    sign.paint({
      frame: lanes.frame,
      ball: lanes.ballInFrame,
      standing: lanes.standing,
      call: recent,
      knocked: lanes.lastKnocked,
      strikes: lanes.strikes,
      spares: lanes.spares,
    })
  })

  // Stars, arrows and boards, laid out once: the same lane every time.
  const stars = useMemo(
    () =>
      Array.from({ length: STARS }, (_, i) => ({
        x: (hash(i, 12.9898) * 2 - 1) * (c.halfWidth - 0.08),
        z: c.endZ + 0.1 + hash(i, 78.233) * (length - 0.2),
        r: 0.018 + ((i * 7) % 3) * 0.008,
      })),
    [c, length]
  )
  const boards = useMemo(() => {
    const n = Math.floor((c.halfWidth * 2) / 0.36)
    return Array.from({ length: n - 1 }, (_, i) => -c.halfWidth + ((i + 1) * c.halfWidth * 2) / n)
  }, [c])
  const arrowZ = c.ballZ - 2.3

  return (
    <>
      {/* The lane: one polished slab from the ball's end to the back of the deck. */}
      <mesh position={[0, c.y - 0.1, midZ]}>
        <boxGeometry args={[c.halfWidth * 2, 0.2, length]} />
        {/* A little see-through, so pins falling into the pit and coins
            riding under the lane can still be followed. */}
        <meshStandardMaterial
          color={PALETTE.lane}
          roughness={0.22}
          metalness={0.15}
          transparent
          opacity={0.78}
        />
      </mesh>
      {boards.map(x => (
        <mesh key={x} position={[x, c.y + 0.002, midZ]}>
          <boxGeometry args={[0.012, 0.002, length]} />
          <meshBasicMaterial color={PALETTE.laneBoard} />
        </mesh>
      ))}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, c.y + 0.004, s.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[s.r, 6]} />
          <meshBasicMaterial color={PALETTE.laneStar} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* The aiming arrows, in a V pointing at the pins, and the foul line in front of the ball. */}
      {[-2, -1, 0, 1, 2].map(i => (
        <mesh
          key={i}
          position={[i * 0.55, c.y + 0.006, arrowZ + Math.abs(i) * 0.3]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <shapeGeometry args={[ARROW]} />
          <meshBasicMaterial color={PALETTE.laneArrow} />
        </mesh>
      ))}
      <mesh position={[0, c.y + 0.006, c.ballZ - BALL_RADIUS - 0.25]}>
        <boxGeometry args={[c.halfWidth * 2, 0.004, 0.06]} />
        <meshBasicMaterial color={PALETTE.foulLine} />
      </mesh>
      {/* Pin spots: where each pin is set, seen once it's knocked down. */}
      {lanes.spots.map((s, i) => (
        <mesh key={i} position={[s.x, c.y + 0.005, s.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PUCK_RADIUS - 0.08, PUCK_RADIUS, 28]} />
          <meshBasicMaterial color={PALETTE.pinSpot} transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Gutters along both sides, and the kickbacks walling in the pin deck. */}
      {[-1, 1].map(side => (
        <group key={side}>
          <mesh position={[side * (c.halfWidth + GUTTER_WIDTH / 2), c.y - 0.3, midZ]}>
            <boxGeometry args={[GUTTER_WIDTH, 0.06, length]} />
            <meshStandardMaterial color={PALETTE.laneGutter} roughness={0.5} />
          </mesh>
          <mesh position={[side * (c.halfWidth + GUTTER_WIDTH + 0.03), c.y - 0.12, midZ]}>
            <boxGeometry args={[0.06, 0.36, length]} />
            <meshStandardMaterial color={PALETTE.laneGutter} roughness={0.5} />
          </mesh>
          <mesh
            position={[
              side * (c.halfWidth + 0.06),
              c.y + KICKBACK_HEIGHT / 2,
              (kickFrom + c.endZ) / 2,
            ]}
          >
            <boxGeometry args={[0.12, KICKBACK_HEIGHT, kickFrom - c.endZ]} />
            <meshStandardMaterial color={PALETTE.kickback} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
      {/* The scoreboard sign, hung on the back wall over the pit. */}
      <mesh position={[0, c.y + (SIGN_BOTTOM + SIGN_TOP) / 2, SIGN_Z]}>
        <planeGeometry args={[c.halfWidth * 2 + 1.2, SIGN_TOP - SIGN_BOTTOM]} />
        <meshBasicMaterial map={sign.texture} />
      </mesh>
      {/* The pinsetter: its plate holding pins up, and the sweep bar. */}
      <mesh ref={plate} visible={false} position={[0, c.y + LIFT_HEIGHT, (c.headZ + c.endZ) / 2]}>
        <boxGeometry args={[c.halfWidth * 2 - 0.1, 0.06, c.headZ - c.endZ + 0.4]} />
        <meshStandardMaterial color={PALETTE.pinsetter} transparent opacity={0.55} />
      </mesh>
      <mesh ref={bar} visible={false}>
        <boxGeometry args={[c.halfWidth * 2 - 0.06, BAR_HEIGHT, BAR_DEPTH]} />
        <meshStandardMaterial color={PALETTE.sweepBar} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* The strength gauge, standing beside the ball: fills from the bottom. */}
      <group ref={gauge} visible={false} position={[c.halfWidth - 0.35, c.y, c.ballZ]}>
        <mesh position={[0, GAUGE_H / 2, 0]}>
          <boxGeometry args={[0.24, GAUGE_H + 0.06, 0.06]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.25} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.18, GAUGE_H, 0.04]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.06, 0.01, 10]} />
        <meshBasicMaterial ref={dotMaterial} color={PALETTE.aim} transparent opacity={0.6} />
      </instancedMesh>
    </>
  )
}

/** A fixed scatter in 0…1: the same stars on the lane every time. */
function hash(i: number, k: number): number {
  const v = Math.sin((i + 1) * k) * 43758.5453
  return v - Math.floor(v)
}

/** A lane arrow: a slim gold triangle pointing up the lane (-z, once laid flat). */
const ARROW = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.32)
  shape.lineTo(0.09, 0)
  shape.lineTo(-0.09, 0)
  shape.closePath()
  return shape
})()

type SignState = {
  frame: number
  ball: 1 | 2
  standing: readonly boolean[]
  call: BowlingDelivery['lastCall']
  knocked: number
  strikes: number
  spares: number
}

/**
 * The scoreboard sign, drawn on a canvas (no font files to load), and only
 * redrawn when what it says changes. It shows the frame and ball, the
 * rack as a triangle of circles (filled for a pin standing, an empty ring
 * for one down, so it doesn't rely on colour), the last ball's call for a
 * moment after it, and the strikes and spares so far.
 */
class SignPainter {
  readonly texture: THREE.CanvasTexture
  private readonly canvas: HTMLCanvasElement
  private last = ''

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 640
    this.canvas.height = 256
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
  }

  paint(s: SignState) {
    const key = JSON.stringify(s)
    if (key === this.last) return
    this.last = key
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = this.canvas
    ctx.fillStyle = PALETTE.sign
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = PALETTE.laneArrow
    ctx.lineWidth = 6
    ctx.strokeRect(6, 6, w - 12, h - 12)
    // The top of the sign is a strip of night sky with a crescent moon: the
    // score box can sit over it on a wide screen, so nothing to read is there.
    ctx.fillStyle = PALETTE.signText
    for (let k = 0; k < 14; k++) {
      const x = 30 + ((k * 211) % (w - 60))
      const y = 22 + ((k * 37) % 46)
      ctx.fillRect(x, y, 3, 3)
    }
    ctx.beginPath()
    ctx.arc(w / 2, 46, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.sign
    ctx.beginPath()
    ctx.arc(w / 2 + 10, 39, 18, 0, Math.PI * 2)
    ctx.fill()
    // The big line: the call just made, else the frame.
    const big =
      s.call === 'strike'
        ? 'STRIKE!'
        : s.call === 'spare'
          ? 'SPARE!'
          : s.call === 'gutter'
            ? 'GUTTER'
            : s.call === 'down'
              ? `${s.knocked} DOWN`
              : `FRAME ${s.frame}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = 'bold 72px system-ui, sans-serif'
    ctx.fillStyle = s.call === 'strike' || s.call === 'spare' ? PALETTE.laneArrow : PALETTE.signText
    ctx.fillText(big, 30, 140)
    ctx.font = '28px system-ui, sans-serif'
    ctx.fillStyle = PALETTE.signText
    ctx.fillText(`Ball ${s.ball}  ·  Strikes ${s.strikes}  ·  Spares ${s.spares}`, 30, 214)
    // The rack, head pin nearest the player (at the bottom), as the player sees it.
    const cx = w - 120
    const r = 17
    const gap = 46
    let i = 0
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k <= row; k++) {
        const x = cx + (k - row / 2) * gap
        const y = 205 - row * gap * 0.87
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        if (s.standing[i]) {
          ctx.fillStyle = PALETTE.signText
          ctx.fill()
        } else {
          ctx.strokeStyle = PALETTE.signText
          ctx.lineWidth = 3
          ctx.stroke()
        }
        i++
      }
    }
    this.texture.needsUpdate = true
  }

  dispose() {
    this.texture.dispose()
  }
}
