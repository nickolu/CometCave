'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_GAP,
  BACK_WALL_Z,
  DROP_Z,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  PHYSICS_STEP_S,
  PUSHER_DEPTH,
  PUSHER_HEIGHT,
  WALL_HEIGHT,
} from '@/app/meteor-coins/lib/cabinet'
import {
  ARM_LENGTH,
  ARM_PIVOT_Y,
  RING_RADIUS,
  RING_TUBE,
  RING_Y,
  armAngle,
  ringX,
} from '@/app/meteor-coins/lib/dropper'
import type { Obstacle } from '@/app/meteor-coins/lib/engine'
import type { DropGame, GameEvent } from '@/app/meteor-coins/lib/game'
import type { ObjectSpec, Part } from '@/app/meteor-coins/lib/objects'
import { type Insets, fitCamera } from '@/app/meteor-coins/scene/framing'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Never run more than this many physics steps in one frame (e.g. after a stall). */
const MAX_STEPS_PER_FRAME = 4
const RING_FLASH_S = 0.4

/**
 * Draws a DropGame and drives its clock. The game is the source of truth;
 * this only steps it at a fixed rate and copies positions onto meshes.
 */
export function Scene({ game, onStep }: { game: DropGame; onStep: (events: GameEvent[]) => void }) {
  // One instanced mesh per part of each kind of object on the table.
  const groups = useMemo(() => {
    const bySpec = new Map<ObjectSpec, number[]>()
    game.engine.pucks.forEach((puck, i) => {
      const list = bySpec.get(puck.spec) ?? []
      list.push(i)
      bySpec.set(puck.spec, list)
    })
    return [...bySpec].map(([spec, indices]) => ({ spec, indices }))
  }, [game])
  const groupMeshes = useRef<(THREE.InstancedMesh | null)[][]>([])
  const pusher = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Group>(null)
  const heldCoin = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const cue = useRef<THREE.Group>(null)
  const cueOpen = useRef<THREE.Object3D>(null)
  const cueClosed = useRef<THREE.Object3D>(null)
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
    groups.forEach(({ indices }, g) => {
      const meshes = groupMeshes.current[g] ?? []
      indices.forEach((index, i) => {
        const puck = game.engine.pucks[index]
        if (puck.active) {
          const t = puck.body.translation()
          const r = puck.body.rotation()
          s.m.compose(s.p.set(t.x, t.y, t.z), s.q.set(r.x, r.y, r.z, r.w), s.one)
        } else {
          s.m.compose(s.p.set(0, -50, 0), s.q.identity(), s.zero)
        }
        for (const mesh of meshes) mesh?.setMatrixAt(i, s.m)
      })
      for (const mesh of meshes) if (mesh) mesh.instanceMatrix.needsUpdate = true
    })

    if (cue.current && game.stage.cue) {
      const open = game.canDrop && game.dropLandsClear
      if (game.stage.cue === 'shadow') cue.current.position.x = game.armTip().x
      cue.current.visible = game.canDrop
      if (cueOpen.current) cueOpen.current.visible = open
      if (cueClosed.current) cueClosed.current.visible = !open
    }

    pusher.current?.position.set(0, PUSHER_HEIGHT / 2, game.engine.pusherZ)
    arm.current?.rotation.set(0, 0, armAngle(game.dropperTime, game.stage.arm.periodS))
    if (heldCoin.current) heldCoin.current.visible = game.canDrop
    ring.current?.position.set(ringX(game.dropperTime), RING_Y, DROP_Z)
    if (ring.current) ring.current.visible = game.stage.ring.enabled

    flash.current = Math.max(0, flash.current - delta)
    ringMaterial.current?.color.copy(flash.current > 0 ? s.hit : s.base)
    ringMaterial.current?.emissive.copy(flash.current > 0 ? s.hit : s.base)
  })

  const drop = game.stage.objects.drop

  return (
    <>
      <Cabinet
        chuteHalfWidth={game.engine.chuteHalfWidth}
        obstacles={game.stage.table.obstacles ?? []}
      />

      <mesh ref={pusher} position={[0, PUSHER_HEIGHT / 2, game.engine.pusherZ]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2 - 0.04, PUSHER_HEIGHT - 0.01, PUSHER_DEPTH]} />
        <meshStandardMaterial color={PALETTE.pusher} />
      </mesh>

      {groups.map(({ spec, indices }, g) =>
        spec.parts.map((part, p) => (
          <instancedMesh
            key={`${spec.id}-${p}`}
            ref={mesh => {
              groupMeshes.current[g] ??= []
              groupMeshes.current[g][p] = mesh
            }}
            args={[partGeometry(part), undefined, indices.length]}
            frustumCulled={false}
          >
            <PartMaterial part={part} />
          </instancedMesh>
        ))
      )}

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
        <group ref={heldCoin} position={[0, -ARM_LENGTH, 0]}>
          {drop.parts.map((part, p) => (
            <mesh key={p} geometry={partGeometry(part)}>
              <PartMaterial part={part} />
            </mesh>
          ))}
        </group>
      </group>

      {game.stage.cue === 'chevrons' && (
        <ChevronCue groupRef={cue} openRef={cueOpen} closedRef={cueClosed} />
      )}
      {game.stage.cue === 'shadow' && (
        <ShadowCue groupRef={cue} openRef={cueOpen} closedRef={cueClosed} radius={drop.reach} />
      )}

      {/* Skill-shot ring: lies flat, slides left and right */}
      <mesh ref={ring} position={[0, RING_Y, DROP_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_RADIUS, RING_TUBE, 12, 40]} />
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

const geometryCache = new Map<Part, THREE.BufferGeometry>()

/** A part's shape, already moved to its place on the object. Cached: parts are static data. */
function partGeometry(part: Part): THREE.BufferGeometry {
  const cached = geometryCache.get(part)
  if (cached) return cached
  let g: THREE.BufferGeometry
  switch (part.shape) {
    case 'cylinder':
      g = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 28)
      break
    case 'box':
      g = new THREE.BoxGeometry(...part.size)
      break
    case 'ball':
      g = new THREE.SphereGeometry(part.radius, 16, 12)
      break
    case 'arc':
      g = new THREE.TorusGeometry(part.radius, part.tube, 8, 24, part.arc).rotateX(Math.PI / 2)
      break
  }
  const [x, y, z] = part.at ?? [0, 0, 0]
  g.translate(x, y, z)
  geometryCache.set(part, g)
  return g
}

function PartMaterial({ part }: { part: Part }) {
  const metal = part.tone === 'puck'
  return (
    <meshStandardMaterial
      color={PALETTE[part.tone]}
      metalness={metal ? 0.3 : 0.05}
      roughness={metal ? 0.55 : 0.7}
    />
  )
}

type CueRefs = {
  groupRef: React.RefObject<THREE.Group | null>
  openRef: React.RefObject<THREE.Object3D | null>
  closedRef: React.RefObject<THREE.Object3D | null>
}

const CHEVRON = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(-0.32, 0.22)
  shape.lineTo(0, -0.1)
  shape.lineTo(0.32, 0.22)
  shape.lineTo(0.32, 0.06)
  shape.lineTo(0, -0.26)
  shape.lineTo(-0.32, 0.06)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
})()

/**
 * Penny Falls' cue: chevrons on the back wall pointing down at the drop line.
 * Bright and full when a drop now lands on bare shelf; a single faint
 * chevron when it doesn't — the change is in size and brightness, not hue.
 */
function ChevronCue({ groupRef, openRef, closedRef }: CueRefs) {
  const xs = [-2.4, -1.2, 0, 1.2, 2.4]
  return (
    <group ref={groupRef} position={[0, PUSHER_HEIGHT + 0.55, BACK_WALL_Z + 0.01]}>
      <group ref={openRef}>
        {xs.map(x => (
          <mesh key={x} geometry={CHEVRON} position={[x, 0, 0]}>
            <meshBasicMaterial color={PALETTE.cue} />
          </mesh>
        ))}
      </group>
      <group ref={closedRef}>
        {xs.map(x => (
          <mesh key={x} geometry={CHEVRON} position={[x, 0, 0]} scale={0.6}>
            <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.18} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * Moonstone Porch's cue: a landing shadow under the arm, on the drop line. A
 * solid disc when the spot below is bare, an open ring when it isn't. Drawn
 * over the pile so it never hides under coins.
 */
function ShadowCue({ groupRef, openRef, closedRef, radius }: CueRefs & { radius: number }) {
  return (
    <group ref={groupRef} position={[0, PUSHER_HEIGHT + 0.02, DROP_Z]} renderOrder={10}>
      <mesh ref={openRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.75} depthTest={false} />
      </mesh>
      <mesh ref={closedRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[radius - 0.08, radius, 32]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.45} depthTest={false} />
      </mesh>
    </group>
  )
}

/** The fixed parts of the machine: floor, walls, back wall, chute markings, obstacles. */
function Cabinet({
  chuteHalfWidth,
  obstacles,
}: {
  chuteHalfWidth: number
  obstacles: readonly Obstacle[]
}) {
  const fieldDepth = FIELD_FRONT_Z - FIELD_BACK_Z
  const fieldMidZ = (FIELD_BACK_Z + FIELD_FRONT_Z) / 2
  const wallBottom = PUSHER_HEIGHT + BACK_WALL_GAP
  const wallHeight = WALL_HEIGHT + 2 - wallBottom
  const gutterWidth = FIELD_HALF_WIDTH - chuteHalfWidth

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
        <boxGeometry args={[chuteHalfWidth * 2, 0.01, 0.12]} />
        <meshStandardMaterial
          color={PALETTE.chute}
          emissive={PALETTE.chute}
          emissiveIntensity={0.6}
        />
      </mesh>
      {obstacles.map((o, i) =>
        o.type === 'post' ? (
          <mesh key={i} position={[o.x, o.height / 2, o.z]}>
            <cylinderGeometry args={[o.radius, o.radius, o.height, 20]} />
            <meshStandardMaterial color={PALETTE.obstacle} />
          </mesh>
        ) : (
          <mesh key={i} position={[o.x, o.height / 2, o.z]}>
            <boxGeometry args={[o.width, o.height, o.depth]} />
            <meshStandardMaterial color={PALETTE.obstacle} />
          </mesh>
        )
      )}
      {gutterWidth > 0 &&
        [-1, 1].map(side => (
          <mesh
            key={side}
            position={[side * (chuteHalfWidth + gutterWidth / 2), 0.005, FIELD_FRONT_Z - 0.06]}
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

/** Keeps the camera fitted to the cabinet as the screen changes size. */
export function CabinetCamera({ insets }: { insets: Insets }) {
  const get = useThree(s => s.get)
  const size = useThree(s => s.size)

  useEffect(() => {
    fitCamera(get().camera as THREE.PerspectiveCamera, size.width, size.height, insets)
  }, [get, size, insets])

  return null
}
