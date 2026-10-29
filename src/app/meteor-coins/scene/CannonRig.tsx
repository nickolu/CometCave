'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { HOOP_BOARD_TOP, type Hoop, hoopX } from '@/app/meteor-coins/lib/cannon'
import type { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Dots along the arc preview, one every this many physics steps of flight. */
const DOT_EVERY = 3
const MAX_DOTS = 60
/** Dashes along the flat aim line. */
const MAX_DASHES = 40
const HOOP_TUBE = 0.06
/** The backboard: this wide, standing from the rim's height up to HOOP_BOARD_TOP. */
const BOARD_WIDTH = 1.9
const BOARD_THICK = 0.08
/** Hoops hang from strings up to here. */
const STRING_TOP = 6.5
/** A sliding hoop's track runs this far above its backboard. */
const TRACK_ABOVE = 0.45

/**
 * Hoop-La Cannon's launcher: the brass cannon swinging at the front, the
 * coin in its mouth, a charge gauge beside it, and the three flat hoops on
 * their backboards (the +10 sliding along a track).
 *
 * The aim shows in two steps, the way it's played. While the cannon
 * swings, a flat dashed line runs along the table where it points, with a
 * faint ring on that line's level under each hoop to line up against.
 * Once the direction is locked the line goes and the dotted arc shows the
 * distance instead, growing as the charge fills. Reads the game every
 * frame; owns no state of its own.
 */
export function CannonRig({ game, cannon: delivery }: { game: DropGame; cannon: CannonDelivery }) {
  const cannon = delivery.config
  const barrel = useRef<THREE.Group>(null)
  const loaded = useRef<THREE.Mesh>(null)
  const gauge = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const dashes = useRef<THREE.InstancedMesh>(null)
  const hoops = useRef<(THREE.Group | null)[]>([])
  const marks = useRef<(THREE.Mesh | null)[]>([])
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(1, 1, 1),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
    }),
    []
  )

  useFrame(() => {
    const yaw = delivery.yaw
    barrel.current?.rotation.set(cannon.elevation, -yaw, 0, 'YXZ')
    if (loaded.current) loaded.current.visible = game.canDrop
    const charge = delivery.charge
    if (gauge.current) gauge.current.visible = delivery.isLocked
    if (fill.current) {
      // Scaled about its middle, so moved up by half as much to fill from the bottom.
      const f = Math.max(0.001, charge ?? 0)
      fill.current.scale.set(1, f, 1)
      fill.current.position.y = 0.6 * f
    }
    cannon.hoops.forEach((hoop, i) => {
      const x = hoopX(hoop, game.dropperTime)
      hoops.current[i]?.position.set(x, 0, hoop.z)
      const mark = marks.current[i]
      if (mark) {
        mark.position.x = x
        mark.visible = game.canDrop && !delivery.isLocked
      }
    })

    // Step one: the flat line along the table.
    const line = game.canDrop ? delivery.aimLine() : []
    const dash = dashes.current
    if (dash) {
      scratch.q.setFromEuler(scratch.e.set(0, -yaw, 0))
      for (let i = 0; i < MAX_DASHES; i++) {
        const p = line[i]
        if (p)
          dash.setMatrixAt(i, scratch.m.compose(scratch.p.set(p.x, p.y, p.z), scratch.q, scratch.s))
        else dash.setMatrixAt(i, scratch.hidden)
      }
      dash.instanceMatrix.needsUpdate = true
    }

    // Step two: the arc, growing with the charge.
    const mesh = dots.current
    if (!mesh) return
    const path = game.canDrop ? delivery.previewPath() : []
    for (let i = 0; i < MAX_DOTS; i++) {
      const p = path[(i + 1) * DOT_EVERY]
      if (p) mesh.setMatrixAt(i, scratch.m.makeTranslation(p.x, p.y, p.z))
      else mesh.setMatrixAt(i, scratch.hidden)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  const { pivot, barrel: length } = cannon
  const lineY = pivot.y + length * Math.sin(cannon.elevation)
  return (
    <>
      {/* Carriage, with the barrel turning on top of it. */}
      <mesh position={[pivot.x, pivot.y / 2 - 0.1, pivot.z + 0.1]}>
        <boxGeometry args={[1.1, pivot.y - 0.2, 0.9]} />
        <meshStandardMaterial color={PALETTE.backWall} />
      </mesh>
      <group ref={barrel} position={[pivot.x, pivot.y, pivot.z]}>
        <mesh position={[0, 0, -length / 2 + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.3, length + 0.4, 24]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh ref={loaded} position={[0, 0.02, -length]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.06, 20]} />
          <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
        </mesh>
      </group>
      {/* Charge gauge: a frame beside the cannon, shown once the direction is locked, that fills from the bottom. */}
      <group ref={gauge} position={[pivot.x + 0.95, 0.15, pivot.z]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.22, 1.24, 0.06]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.25} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.16, 1.2, 0.04]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
      </group>
      <instancedMesh ref={dashes} args={[undefined, undefined, MAX_DASHES]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.025, 0.22]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.85} />
      </instancedMesh>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.8} />
      </instancedMesh>
      {cannon.hoops.map((hoop, i) => (
        <mesh
          key={`mark-${i}`}
          ref={m => {
            marks.current[i] = m
          }}
          position={[hoop.x, lineY, hoop.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[hoop.radius - 0.05, hoop.radius, 40]} />
          <meshBasicMaterial color={PALETTE.hoop} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
      {cannon.hoops.map((hoop, i) => (
        <group
          key={i}
          ref={g => {
            hoops.current[i] = g
          }}
          position={[hoop.x, 0, hoop.z]}
        >
          <HoopMesh hoop={hoop} />
        </group>
      ))}
      {cannon.hoops.map((hoop, i) => hoop.sweep && <HoopTrack key={`track-${i}`} hoop={hoop} />)}
    </>
  )
}

/**
 * A flat hoop, drawn about its own center: the rim, a bracket back to its
 * backboard with the bonus written on it, and what holds the board up —
 * strings for a fixed hoop, a carriage on the track for a sliding one.
 */
function HoopMesh({ hoop }: { hoop: Hoop }) {
  const label = useMemo(() => labelTexture(`+${hoop.bonus}`), [hoop.bonus])
  const boardZ = -hoop.radius - HOOP_TUBE - 0.25
  const boardH = HOOP_BOARD_TOP + 0.25
  const boardY = hoop.y - 0.25 + boardH / 2
  const top = hoop.y + HOOP_BOARD_TOP
  return (
    <>
      <mesh position={[0, hoop.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hoop.radius + HOOP_TUBE, HOOP_TUBE, 12, 48]} />
        <meshStandardMaterial
          color={PALETTE.hoop}
          emissive={PALETTE.hoop}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Bracket from the back of the rim to the board. */}
      <mesh position={[0, hoop.y, boardZ / 2 - hoop.radius / 2]}>
        <boxGeometry args={[0.12, 0.06, -boardZ - hoop.radius]} />
        <meshStandardMaterial color={PALETTE.hoop} />
      </mesh>
      <mesh position={[0, boardY, boardZ]}>
        <boxGeometry args={[BOARD_WIDTH, boardH, BOARD_THICK]} />
        <meshStandardMaterial color={PALETTE.hoopBoard} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, boardY + 0.1, boardZ + BOARD_THICK / 2 + 0.01]}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshBasicMaterial map={label} transparent />
      </mesh>
      {hoop.sweep ? (
        // The carriage up to the track.
        <mesh position={[0, top + TRACK_ABOVE / 2, boardZ]}>
          <boxGeometry args={[0.3, TRACK_ABOVE, 0.12]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
        </mesh>
      ) : (
        [-1, 1].map(side => (
          <mesh key={side} position={[side * BOARD_WIDTH * 0.4, (top + STRING_TOP) / 2, boardZ]}>
            <boxGeometry args={[0.02, STRING_TOP - top, 0.02]} />
            <meshBasicMaterial color={PALETTE.hoopLabel} transparent opacity={0.4} />
          </mesh>
        ))
      )}
    </>
  )
}

/** The track a sliding hoop runs along, hung on strings at its ends. */
function HoopTrack({ hoop }: { hoop: Hoop }) {
  const amp = hoop.sweep?.ampX ?? 0
  const half = amp + 0.6
  const y = hoop.y + HOOP_BOARD_TOP + TRACK_ABOVE
  const z = hoop.z - hoop.radius - HOOP_TUBE - 0.25
  return (
    <group position={[hoop.x, 0, z]}>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[half * 2, 0.08, 0.12]} />
        <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * half, (y + STRING_TOP) / 2, 0]}>
          <boxGeometry args={[0.02, STRING_TOP - y, 0.02]} />
          <meshBasicMaterial color={PALETTE.hoopLabel} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/** A bonus tag, drawn on a canvas: no font files to load. */
function labelTexture(text: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.hoop
    ctx.beginPath()
    ctx.roundRect(8, 8, 176, 112, 24)
    ctx.fill()
    ctx.fillStyle = PALETTE.hoopLabel
    ctx.font = 'bold 76px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 96, 68)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
