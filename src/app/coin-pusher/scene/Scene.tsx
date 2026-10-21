'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_GAP,
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  DROP_Z,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  PHYSICS_STEP_S,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_DEPTH,
  PUSHER_HEIGHT,
  SQUARE_SIDE,
  WALL_HEIGHT,
} from '@/app/coin-pusher/lib/cabinet'
import {
  ARM_LENGTH,
  ARM_PIVOT_Y,
  RING_RADIUS,
  RING_Y,
  armAngle,
  ringX,
} from '@/app/coin-pusher/lib/dropper'
import { POOL_SIZE } from '@/app/coin-pusher/lib/engine'
import type { DropGame, GameEvent } from '@/app/coin-pusher/lib/game'
import { PALETTE } from '@/app/coin-pusher/scene/palette'

/** Never run more than this many physics steps in one frame (e.g. after a stall). */
const MAX_STEPS_PER_FRAME = 4
const RING_FLASH_S = 0.4

/**
 * Draws a DropGame and drives its clock. The game is the source of truth;
 * this only steps it at a fixed rate and copies positions onto meshes.
 */
export function Scene({ game, onStep }: { game: DropGame; onStep: (events: GameEvent[]) => void }) {
  const pucks = useRef<THREE.InstancedMesh>(null)
  const pusher = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Group>(null)
  const heldCoin = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const acc = useRef(0)
  const flash = useRef(0)
  const scratch = useRef({
    m: new THREE.Matrix4(),
    p: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    one: new THREE.Vector3(1, 1, 1),
    zero: new THREE.Vector3(0, 0, 0),
    base: new THREE.Color(PALETTE.ring),
    hit: new THREE.Color(PALETTE.ringHit),
  })

  useFrame((_, delta) => {
    acc.current += Math.min(delta, 0.1)
    const events: GameEvent[] = []
    let steps = 0
    while (acc.current >= PHYSICS_STEP_S && steps < MAX_STEPS_PER_FRAME) {
      events.push(...game.step())
      acc.current -= PHYSICS_STEP_S
      steps++
    }
    if (steps === MAX_STEPS_PER_FRAME) acc.current = 0
    if (events.some(e => e.type === 'shot' && e.hit)) flash.current = RING_FLASH_S
    onStep(events)

    const s = scratch.current
    const mesh = pucks.current
    if (mesh) {
      game.engine.pucks.forEach((puck, i) => {
        if (puck.active) {
          const t = puck.body.translation()
          const r = puck.body.rotation()
          s.m.compose(s.p.set(t.x, t.y, t.z), s.q.set(r.x, r.y, r.z, r.w), s.one)
        } else {
          s.m.compose(s.p.set(0, -50, 0), s.q.identity(), s.zero)
        }
        mesh.setMatrixAt(i, s.m)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    pusher.current?.position.set(0, PUSHER_HEIGHT / 2, game.engine.pusherZ)
    arm.current?.rotation.set(0, 0, armAngle(game.dropperTime))
    if (heldCoin.current) heldCoin.current.visible = game.canDrop
    ring.current?.position.set(ringX(game.dropperTime), RING_Y, DROP_Z)

    flash.current = Math.max(0, flash.current - delta)
    ringMaterial.current?.color.copy(flash.current > 0 ? s.hit : s.base)
    ringMaterial.current?.emissive.copy(flash.current > 0 ? s.hit : s.base)
  })

  const round = game.engine.shape === 'round'
  const puckGeometry = round ? (
    <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 28]} />
  ) : (
    <boxGeometry args={[SQUARE_SIDE, PUCK_THICKNESS, SQUARE_SIDE]} />
  )

  return (
    <>
      <Cabinet />

      <mesh ref={pusher} position={[0, PUSHER_HEIGHT / 2, game.engine.pusherZ]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2 - 0.04, PUSHER_HEIGHT - 0.01, PUSHER_DEPTH]} />
        <meshStandardMaterial color={PALETTE.pusher} />
      </mesh>

      <instancedMesh ref={pucks} args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
        {puckGeometry}
        <meshStandardMaterial color={PALETTE.puck} metalness={0.35} roughness={0.35} />
      </instancedMesh>

      {/* Swinging arm: pivots above the table, holds the next coin at its tip */}
      <group ref={arm} position={[0, ARM_PIVOT_Y, DROP_Z]}>
        <mesh position={[0, -ARM_LENGTH / 2, 0]}>
          <boxGeometry args={[0.12, ARM_LENGTH, 0.12]} />
          <meshStandardMaterial color={PALETTE.arm} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, -ARM_LENGTH + 0.2, 0]}>
          <boxGeometry args={[1.2, 0.12, 0.3]} />
          <meshStandardMaterial color={PALETTE.arm} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={heldCoin} position={[0, -ARM_LENGTH, 0]}>
          {puckGeometry}
          <meshStandardMaterial color={PALETTE.puck} metalness={0.35} roughness={0.35} />
        </mesh>
      </group>

      {/* Skill-shot ring: lies flat, slides left and right */}
      <mesh ref={ring} position={[0, RING_Y, DROP_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_RADIUS, 0.09, 12, 40]} />
        <meshStandardMaterial
          ref={ringMaterial}
          color={PALETTE.ring}
          emissive={PALETTE.ring}
          emissiveIntensity={0.5}
        />
      </mesh>
    </>
  )
}

/** The fixed parts of the machine: floor, walls, back wall, chute markings. */
function Cabinet() {
  const fieldDepth = FIELD_FRONT_Z - FIELD_BACK_Z
  const fieldMidZ = (FIELD_BACK_Z + FIELD_FRONT_Z) / 2
  const wallBottom = PUSHER_HEIGHT + BACK_WALL_GAP
  const wallHeight = WALL_HEIGHT + 2 - wallBottom
  const gutterWidth = FIELD_HALF_WIDTH - CHUTE_HALF_WIDTH

  return (
    <>
      <mesh position={[0, -0.25, fieldMidZ]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2, 0.5, fieldDepth]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (FIELD_HALF_WIDTH + 0.25), WALL_HEIGHT / 2, fieldMidZ]}>
          <boxGeometry args={[0.5, WALL_HEIGHT, fieldDepth]} />
          <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.12} />
        </mesh>
      ))}
      <mesh position={[0, wallBottom + wallHeight / 2, BACK_WALL_Z - 0.25]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2, wallHeight, 0.5]} />
        <meshStandardMaterial color={PALETTE.backWall} />
      </mesh>
      <mesh position={[0, 0.005, FIELD_FRONT_Z - 0.06]}>
        <boxGeometry args={[CHUTE_HALF_WIDTH * 2, 0.01, 0.12]} />
        <meshStandardMaterial
          color={PALETTE.chute}
          emissive={PALETTE.chute}
          emissiveIntensity={0.6}
        />
      </mesh>
      {[-1, 1].map(side => (
        <mesh
          key={side}
          position={[side * (CHUTE_HALF_WIDTH + gutterWidth / 2), 0.005, FIELD_FRONT_Z - 0.06]}
        >
          <boxGeometry args={[gutterWidth, 0.01, 0.12]} />
          <meshStandardMaterial
            color={PALETTE.gutter}
            emissive={PALETTE.gutter}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </>
  )
}

/**
 * Points the camera from where a player would stand at the machine. On a
 * portrait screen the vertical field of view widens so the full cabinet width
 * still fits, and the camera looks down more steeply to use the spare height.
 * Framed to include the arm's pivot so the swing reads at a glance.
 */
export function CabinetCamera() {
  const get = useThree(s => s.get)
  const size = useThree(s => s.size)

  useEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const minHorizontalFov = (56 * Math.PI) / 180
    const fitWidth = (2 * Math.atan(Math.tan(minHorizontalFov / 2) / aspect) * 180) / Math.PI
    camera.fov = Math.max(48, fitWidth)
    if (aspect < 1) camera.position.set(0, 14, 8)
    else camera.position.set(0, 10, 12)
    camera.lookAt(0, 2, -1.2)
    camera.updateProjectionMatrix()
  }, [get, size])

  return null
}
