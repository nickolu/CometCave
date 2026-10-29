'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_Z,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_HEIGHT,
  WALL_HEIGHT,
} from '@/app/meteor-coins/lib/cabinet'
import {
  GLASS_BALL_RADIUS,
  type PlungerDelivery,
  SHARDS_S,
  plungerVelocity,
} from '@/app/meteor-coins/lib/deliveries/plunger'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Dots along the flight preview, one every this many physics steps. */
const DOT_EVERY = 3
const MAX_DOTS = 50
/** Balls drawn in the air at once. */
const MAX_BALLS = 3
/** Breaks drawn at once, and the shards in each. */
const MAX_SHATTERS = 3
const SHARDS = 12
/** How far the spring travels back at a full pull. */
const PULL_TRAVEL = 0.6
const LANE_LENGTH = 1.4
/** The spring at rest: from the lane's end plate to the ball. */
const SPRING_LENGTH = LANE_LENGTH - GLASS_BALL_RADIUS
/** The cabinet's glass above the walls, up to here (the plunger delivery breaks balls on it). */
const GLASS_TOP = 6.5
const BACK_WALL_TOP = WALL_HEIGHT + 2
/** The landing marker sits on the pusher's top, drawn over the pile. */
const MARK_Y = PUSHER_HEIGHT + 0.03

/** Whether the player has asked for less motion. */
function useReducedMotion() {
  const reduced = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      reduced.current = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/**
 * Gravity Assist's plunger: the spring lane at the front right with the
 * glass ball in its mouth, a gauge that fills as the spring is pulled, the
 * dotted flight the ball would take (bent by the moon) with a marker where
 * it comes down, balls in the air, and the shards when one breaks. Also the
 * cabinet's glass above the walls, which balls break on. Reads the game
 * every frame; owns no state of its own.
 */
export function PlungerRig({ game, plunger }: { game: DropGame; plunger: PlungerDelivery }) {
  const c = plunger.config
  const reduced = useReducedMotion()
  const ready = useRef<THREE.Group>(null)
  const spring = useRef<THREE.Mesh>(null)
  const knob = useRef<THREE.Group>(null)
  const gauge = useRef<THREE.Mesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const mark = useRef<THREE.Group>(null)
  const markFill = useRef<THREE.Mesh>(null)
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const shardSets = useRef<(THREE.InstancedMesh | null)[]>([])
  const shardMaterials = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
    }),
    []
  )
  // The lane points the way the ball launches; local +y is up the lane.
  const lane = useMemo(() => {
    const v = plungerVelocity(1, c)
    const dir = new THREE.Vector3(v.x, v.y, v.z).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  }, [c])
  // Each shard's own direction and spin, the same every break so nothing is random.
  const shardDirs = useMemo(
    () =>
      Array.from({ length: SHARDS }, (_, i) => {
        const a = i * 2.39996
        const up = 0.3 + (0.7 * ((i * 7) % SHARDS)) / SHARDS
        const flat = Math.sqrt(1 - up * up)
        return new THREE.Vector3(flat * Math.cos(a), up, flat * Math.sin(a))
      }),
    []
  )

  useFrame(() => {
    const charge = plunger.charge
    const pulled = charge ?? 0
    const canDrop = game.canDrop
    // The ball rides back with the spring; the spring squashes as it's pulled.
    if (ready.current) {
      ready.current.visible = canDrop
      ready.current.position.set(0, -pulled * PULL_TRAVEL, 0)
    }
    if (spring.current) {
      // From the lane's fixed end plate up to the tip the ball rests on.
      const length = SPRING_LENGTH - pulled * PULL_TRAVEL
      spring.current.scale.set(1, length / SPRING_LENGTH, 1)
      spring.current.position.y = -LANE_LENGTH + length / 2
    }
    if (knob.current) knob.current.position.y = -LANE_LENGTH - pulled * PULL_TRAVEL
    if (gauge.current) {
      gauge.current.visible = charge !== null
      const fill = Math.max(0.001, pulled)
      gauge.current.scale.set(1, fill, 1)
      gauge.current.position.y = 0.6 * fill
    }

    const path = canDrop ? plunger.previewPath() : []
    const mesh = dots.current
    if (mesh) {
      for (let i = 0; i < MAX_DOTS; i++) {
        const p = path[(i + 1) * DOT_EVERY]
        mesh.setMatrixAt(i, p ? scratch.m.makeTranslation(p.x, p.y, p.z) : scratch.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    // Where it comes down: a ring, filled in when it would land on bare shelf.
    const end = path[path.length - 1]
    if (mark.current) {
      mark.current.visible = end !== undefined
      if (end) mark.current.position.set(end.x, MARK_Y, Math.max(end.z, BACK_WALL_Z + 0.4))
    }
    if (markFill.current) markFill.current.visible = canDrop && plunger.landsClear()

    const flying = plunger.balls
    for (let i = 0; i < MAX_BALLS; i++) {
      const ball = balls.current[i]
      if (!ball) continue
      const index = flying[i]
      ball.visible = index !== undefined
      if (index === undefined) continue
      const t = game.engine.pucks[index].body.translation()
      ball.position.set(t.x, t.y, t.z)
    }

    const now = game.engine.time
    const breaks = plunger.shatters.slice(-MAX_SHATTERS)
    for (let k = 0; k < MAX_SHATTERS; k++) {
      const set = shardSets.current[k]
      const material = shardMaterials.current[k]
      const s = breaks[k]
      if (!set || !material) continue
      set.visible = s !== undefined
      if (!s) continue
      const age = Math.max(0, now - s.at)
      const fade = Math.max(0, 1 - age / SHARDS_S)
      material.opacity = 0.75 * fade
      // With reduced motion the shards stay put and only fade.
      const fly = reduced.current ? 0 : age
      for (let i = 0; i < SHARDS; i++) {
        const d = shardDirs[(i + s.seed * 5) % SHARDS]
        // Out from the ball's surface, then falling; never through the table.
        const y = s.y + d.y * GLASS_BALL_RADIUS * 0.8 + d.y * 2.2 * fly - 6 * fly * fly
        scratch.p.set(
          s.x + d.x * GLASS_BALL_RADIUS * 0.8 + d.x * 2.2 * fly,
          Math.max(y, 0.05),
          s.z + d.z * GLASS_BALL_RADIUS * 0.8 + d.z * 2.2 * fly
        )
        scratch.e.set(i + fly * 9, i * 1.7 + fly * 6, 0)
        scratch.q.setFromEuler(scratch.e)
        scratch.s.setScalar(0.5 + 0.5 * fade)
        set.setMatrixAt(i, scratch.m.compose(scratch.p, scratch.q, scratch.s))
      }
      set.instanceMatrix.needsUpdate = true
    }
  })

  const fieldDepth = FIELD_FRONT_Z - FIELD_BACK_Z
  const fieldMidZ = (FIELD_FRONT_Z + FIELD_BACK_Z) / 2
  return (
    <>
      {/* The lane, angled the way the ball goes, with the spring and knob behind it. */}
      <group position={[c.at.x, c.at.y, c.at.z]} quaternion={lane}>
        <mesh position={[0, -LANE_LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.66, 0.66, LANE_LENGTH + 0.4, 24, 1, true]} />
          <meshStandardMaterial
            color={PALETTE.glassWall}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -LANE_LENGTH / 2, -0.68]}>
          <boxGeometry args={[0.5, LANE_LENGTH + 0.4, 0.08]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh ref={spring} position={[0, -LANE_LENGTH + SPRING_LENGTH / 2, 0]}>
          <cylinderGeometry args={[0.22, 0.22, SPRING_LENGTH, 12, 8, true]} />
          <meshStandardMaterial
            color={PALETTE.plungerSpring}
            metalness={0.7}
            roughness={0.3}
            wireframe
          />
        </mesh>
        <group ref={knob} position={[0, -LANE_LENGTH, 0]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 10]} />
            <meshStandardMaterial color={PALETTE.arm} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.35, 0]}>
            <sphereGeometry args={[0.28, 18, 12]} />
            <meshStandardMaterial color={PALETTE.hoop} roughness={0.5} />
          </mesh>
        </group>
        <group ref={ready}>
          <GlassBall />
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 24]} />
            <meshStandardMaterial color={PALETTE.silver} metalness={0.4} roughness={0.45} />
          </mesh>
        </group>
      </group>
      {/* Pull gauge: a frame beside the plunger that fills from the bottom. */}
      <group position={[c.at.x - 0.95, 0.15, c.at.z + 0.6]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.22, 1.24, 0.06]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.25} />
        </mesh>
        <mesh ref={gauge} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.16, 1.2, 0.04]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.85} />
      </instancedMesh>
      <group ref={mark} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[0.42, 0.52, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.8} depthTest={false} />
        </mesh>
        <mesh ref={markFill} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[0.34, 28]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} depthTest={false} />
        </mesh>
      </group>
      {Array.from({ length: MAX_BALLS }, (_, i) => (
        <mesh
          key={i}
          ref={mesh => {
            balls.current[i] = mesh
          }}
          visible={false}
        >
          <sphereGeometry args={[GLASS_BALL_RADIUS, 24, 16]} />
          <GlassMaterial />
        </mesh>
      ))}
      {Array.from({ length: MAX_SHATTERS }, (_, k) => (
        <instancedMesh
          key={k}
          ref={mesh => {
            shardSets.current[k] = mesh
          }}
          args={[undefined, undefined, SHARDS]}
          frustumCulled={false}
          visible={false}
        >
          <tetrahedronGeometry args={[0.13]} />
          <meshStandardMaterial
            ref={material => {
              shardMaterials.current[k] = material
            }}
            color={PALETTE.glass}
            emissive={PALETTE.glass}
            emissiveIntensity={0.4}
            transparent
            opacity={0.75}
            roughness={0.1}
          />
        </instancedMesh>
      ))}
      {/* The cabinet's glass above the side walls and the back wall, faint: balls break on it. */}
      {[-1, 1].map(side => (
        <mesh
          key={side}
          position={[side * (FIELD_HALF_WIDTH + 0.05), (WALL_HEIGHT + GLASS_TOP) / 2, fieldMidZ]}
        >
          <boxGeometry args={[0.04, GLASS_TOP - WALL_HEIGHT, fieldDepth]} />
          <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.06} />
        </mesh>
      ))}
      <mesh position={[0, (BACK_WALL_TOP + GLASS_TOP) / 2, BACK_WALL_Z - 0.05]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2, GLASS_TOP - BACK_WALL_TOP, 0.04]} />
        <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.06} />
      </mesh>
    </>
  )
}

function GlassMaterial() {
  return (
    <meshStandardMaterial
      color={PALETTE.glass}
      emissive={PALETTE.glass}
      emissiveIntensity={0.15}
      transparent
      opacity={0.32}
      roughness={0.05}
      metalness={0.1}
      depthWrite={false}
    />
  )
}

/** The glass ball in the plunger's mouth, with a highlight so it reads as glass. */
function GlassBall() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[GLASS_BALL_RADIUS, 24, 16]} />
        <GlassMaterial />
      </mesh>
      <mesh position={[0.22, 0.26, 0.3]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} />
      </mesh>
    </>
  )
}
