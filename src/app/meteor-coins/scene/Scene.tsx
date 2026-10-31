'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_GAP,
  DROP_Z,
  type Deck,
  FIELD_HALF_WIDTH,
  type Layout,
  PHYSICS_STEP_S,
  PUCK_THICKNESS,
  PUSHER_HEIGHT,
  PUSHER_MID_Z,
  WALL_HEIGHT,
  deckDir,
  deckUnder,
  fieldBackZ,
  fieldFrontZ,
  openDecks,
  slotOf,
  topDeck,
} from '@/app/meteor-coins/lib/cabinet'
import type { CannonConfig } from '@/app/meteor-coins/lib/cannon'
import {
  ARM_LENGTH,
  ARM_PIVOT_Y,
  type ArmConfig,
  RING_RADIUS,
  RING_TUBE,
  RING_Y,
  armAngle,
  dropLines,
  ringX,
} from '@/app/meteor-coins/lib/dropper'
import type { Obstacle } from '@/app/meteor-coins/lib/engine'
import type { DropGame, GameEvent } from '@/app/meteor-coins/lib/game'
import type { ObjectSpec, Part, Tone } from '@/app/meteor-coins/lib/objects'
import { CannonRig } from '@/app/meteor-coins/scene/CannonRig'
import { type Insets, fitCamera, keyPoints } from '@/app/meteor-coins/scene/framing'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Never run more than this many physics steps in one frame (e.g. after a stall). */
const MAX_STEPS_PER_FRAME = 4
const RING_FLASH_S = 0.4

/**
 * Draws a DropGame and drives its clock. The game is the source of truth;
 * this only steps it at a fixed rate and copies positions onto meshes.
 */
export function Scene({ game, onStep }: { game: DropGame; onStep: (events: GameEvent[]) => void }) {
  // One instanced mesh per part of each kind of object on the table. Where
  // bonus coins have their own look, the pool's coins get a second set of
  // meshes, and each coin is drawn in one set or the other.
  const groups = useMemo(() => {
    const bySpec = new Map<ObjectSpec, number[]>()
    game.engine.pucks.forEach((puck, i) => {
      const list = bySpec.get(puck.spec) ?? []
      list.push(i)
      bySpec.set(puck.spec, list)
    })
    return [...bySpec].map(([spec, indices]) => ({
      spec,
      indices,
      bonus: spec === game.engine.poolObject ? game.stage.objects.bonus : undefined,
    }))
  }, [game])
  const groupMeshes = useRef<(THREE.InstancedMesh | null)[][]>([])
  const bonusMeshes = useRef<(THREE.InstancedMesh | null)[][]>([])
  const pushers = useRef<(THREE.Mesh | null)[]>([])
  const riders = useRef<THREE.Group>(null)
  const arms = useRef<(THREE.Group | null)[]>([])
  const heldCoins = useRef<(THREE.Group | null)[]>([])
  const ribbons = useRef<(THREE.Object3D | null)[]>([])
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
    hidden: new THREE.Matrix4().makeScale(0, 0, 0),
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
    groups.forEach(({ indices, bonus }, g) => {
      const meshes = groupMeshes.current[g] ?? []
      const bonusSet = (bonus && bonusMeshes.current[g]) || []
      indices.forEach((index, i) => {
        const puck = game.engine.pucks[index]
        if (puck.active) {
          const t = puck.body.translation()
          const r = puck.body.rotation()
          s.m.compose(s.p.set(t.x, t.y, t.z), s.q.set(r.x, r.y, r.z, r.w), s.one)
        } else {
          s.m.compose(s.p.set(0, -50, 0), s.q.identity(), s.zero)
        }
        const asBonus = bonus !== undefined && puck.kind === 'bonus'
        for (const mesh of meshes) mesh?.setMatrixAt(i, asBonus ? s.hidden : s.m)
        for (const mesh of bonusSet) mesh?.setMatrixAt(i, asBonus ? s.m : s.hidden)
      })
      for (const mesh of [...meshes, ...bonusSet]) if (mesh) mesh.instanceMatrix.needsUpdate = true
    })

    if (cue.current && game.stage.cue) {
      const open = game.canDrop && game.cueLit
      if (game.stage.cue === 'shadow') {
        const tip = game.armTip()
        cue.current.position.x = tip.x
        cue.current.position.z = tip.z
      }
      if (game.stage.cue === 'dot') {
        const landing = game.landing()
        cue.current.position.set(landing.x, landing.y + 0.02, landing.z)
      }
      cue.current.visible = game.canDrop
      if (cueOpen.current) cueOpen.current.visible = open
      if (cueClosed.current) cueClosed.current.visible = !open
    }

    const pusherZs = game.engine.pusherZs()
    layout.forEach((deck, i) =>
      pushers.current[i]?.position.set(0, deck.floorY + PUSHER_HEIGHT / 2, pusherZs[i])
    )
    riders.current?.position.set(0, 0, game.engine.pusherZ - PUSHER_MID_Z)
    const angle = armAngle(game.dropperTime, game.stage.arm.periodS)
    arms.current.forEach((arm, i) => {
      arm?.rotation.set(0, 0, angle)
      // Only the arm whose turn it is holds a coin, and wears the ribbon.
      const held = heldCoins.current[i]
      if (held) held.visible = game.canDrop && game.line === i
      const ribbon = ribbons.current[i]
      if (ribbon) ribbon.visible = game.line === i
    })
    ring.current?.position.set(ringX(game.dropperTime, game.stage.ring), RING_Y, DROP_Z)
    if (ring.current) ring.current.visible = game.stage.ring.enabled

    flash.current = Math.max(0, flash.current - delta)
    ringMaterial.current?.color.copy(flash.current > 0 ? s.hit : s.base)
    ringMaterial.current?.emissive.copy(flash.current > 0 ? s.hit : s.base)
  })

  const drop = game.stage.objects.drop
  const { arm: armConfig, table } = game.stage
  const layout = game.engine.layout
  const top = topDeck(layout)
  const obstacles = table.obstacles ?? []
  const pivotY = armConfig.pivotY ?? ARM_PIVOT_Y
  const lines = dropLines(armConfig)

  return (
    <>
      <Cabinet
        layout={layout}
        chuteHalfWidth={game.engine.chuteHalfWidth}
        obstacles={obstacles.filter(o => !o.rides)}
        icy={(table.floorFriction ?? 1) < 0.2}
        floorTone={table.floorTone ?? 'floor'}
      />

      {layout.map((deck, i) => (
        <mesh
          key={i}
          ref={mesh => {
            pushers.current[i] = mesh
          }}
          position={[0, deck.floorY + PUSHER_HEIGHT / 2, game.engine.pusherZs()[i]]}
        >
          <boxGeometry
            args={[FIELD_HALF_WIDTH * 2 - 0.04, PUSHER_HEIGHT - 0.01, deck.pusher.depth]}
          />
          <meshStandardMaterial color={PALETTE[table.pusherTone ?? 'pusher']} />
        </mesh>
      ))}
      {/* Pieces mounted on the pusher, drawn where they stand at mid-stroke and moved with it. */}
      <group ref={riders}>
        {obstacles
          .filter(o => o.rides)
          .map((o, i) => (
            <ObstacleMesh key={i} obstacle={o} />
          ))}
      </group>

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
      {groups.map(({ indices, bonus }, g) =>
        bonus?.parts.map((part, p) => (
          <instancedMesh
            key={`bonus-${g}-${p}`}
            ref={mesh => {
              bonusMeshes.current[g] ??= []
              bonusMeshes.current[g][p] = mesh
            }}
            args={[partGeometry(part), undefined, indices.length]}
            frustumCulled={false}
          >
            <PartMaterial part={part} />
          </instancedMesh>
        ))
      )}

      {/* Swinging arm: pivots above the table, holds the next coin at its tip.
          Where arms take turns there's one per drop line; the one whose turn
          it is holds the coin and wears a bookmark ribbon. */}
      {game.cannon && <CannonRig game={game} cannon={game.cannon} />}
      {!game.cannon &&
        lines.map((z, i) => (
          <group
            key={i}
            ref={group => {
              arms.current[i] = group
            }}
            position={[0, pivotY, z]}
          >
            {/* An arm at the player's end would hide the table behind its rod, so that rod is faint. */}
            <mesh position={[0, -ARM_LENGTH / 2, 0]}>
              <boxGeometry args={[0.12, ARM_LENGTH, 0.12]} />
              <meshStandardMaterial
                color={PALETTE.arm}
                metalness={0.5}
                roughness={0.4}
                transparent={deckUnder(layout, z).pusher.reversed}
                opacity={deckUnder(layout, z).pusher.reversed ? 0.15 : 1}
              />
            </mesh>
            <mesh position={[0, -ARM_LENGTH + 0.2, 0]}>
              <boxGeometry args={[1.2, 0.12, 0.3]} />
              <meshStandardMaterial color={PALETTE.arm} metalness={0.5} roughness={0.4} />
            </mesh>
            <group
              ref={group => {
                heldCoins.current[i] = group
              }}
              position={[0, -ARM_LENGTH, 0]}
            >
              {drop.parts.map((part, p) => (
                <mesh key={p} geometry={partGeometry(part)}>
                  <PartMaterial part={part} />
                </mesh>
              ))}
            </group>
            {lines.length > 1 && (
              <group
                ref={group => {
                  ribbons.current[i] = group
                }}
              >
                <Ribbon />
              </group>
            )}
          </group>
        ))}

      {game.stage.cue === 'chevrons' && (
        <ChevronCue groupRef={cue} openRef={cueOpen} closedRef={cueClosed} deck={top} />
      )}
      {(game.stage.cue === 'shadow' || game.stage.cue === 'dot') && (
        <ShadowCue
          groupRef={cue}
          openRef={cueOpen}
          closedRef={cueClosed}
          radius={drop.reach}
          y={top.floorY + PUSHER_HEIGHT + 0.02}
          z={lines[0]}
        />
      )}

      {/* Skill-shot ring: lies flat, slides left and right */}
      <mesh ref={ring} position={[0, RING_Y, DROP_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[game.stage.ring.radius ?? RING_RADIUS, RING_TUBE, 12, 40]} />
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
      g = part.notches
        ? notchedDisc(part.radius, part.height, part.notches)
        : new THREE.CylinderGeometry(part.radius, part.radius, part.height, 28)
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

/** A coin with V notches cut around its rim, centered like a cylinder. */
function notchedDisc(radius: number, height: number, notches: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const steps = notches * 8
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    // Each notch is the first eighth of its stretch of rim, cut 0.14 deep at its middle.
    const k = i % 8
    const r = k === 1 ? radius - 0.14 : radius
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    .translate(0, 0, -height / 2)
    .rotateX(Math.PI / 2)
}

const METALLIC: readonly Part['tone'][] = ['puck', 'amber', 'bonus']

function PartMaterial({ part }: { part: Part }) {
  const metal = METALLIC.includes(part.tone)
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
function ChevronCue({ groupRef, openRef, closedRef, deck }: CueRefs & { deck: Deck }) {
  const xs = [-2.4, -1.2, 0, 1.2, 2.4]
  return (
    <group ref={groupRef} position={[0, deck.floorY + PUSHER_HEIGHT + 0.55, deck.backZ + 0.01]}>
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
 * A landing shadow under the arm, on the drop line: a solid disc when the
 * drop would land well, an open ring when it wouldn't. Moonstone Porch's sits
 * on the shelf and is solid over bare shelf; The Cairn's sits on whatever the
 * coin would land on and is solid over the middle of a post. Drawn over
 * everything so it never hides under coins.
 */
function ShadowCue({
  groupRef,
  openRef,
  closedRef,
  radius,
  y,
  z,
}: CueRefs & { radius: number; y: number; z: number }) {
  return (
    <group ref={groupRef} position={[0, y, z]} renderOrder={10}>
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
  layout,
  chuteHalfWidth,
  obstacles,
  icy,
  floorTone,
}: {
  layout: Layout
  chuteHalfWidth: number
  obstacles: readonly Obstacle[]
  icy: boolean
  floorTone: Tone
}) {
  const top = topDeck(layout)
  const backZ = fieldBackZ(layout)
  const frontZ = fieldFrontZ(layout)
  const fieldDepth = frontZ - backZ
  const fieldMidZ = (backZ + frontZ) / 2
  const wallTop = top.floorY + WALL_HEIGHT
  const wallBottom = top.floorY + PUSHER_HEIGHT + BACK_WALL_GAP
  const wallHeight = wallTop + 2 - wallBottom
  const gutterWidth = FIELD_HALF_WIDTH - chuteHalfWidth
  // Decks facing each other drop into a slot between them, lit along both edges.
  const slot = slotOf(layout)
  const floors = slot
    ? [
        [backZ, slot[0]],
        [slot[1], frontZ],
      ]
    : [[backZ, frontZ]]
  const edges = slot ? [slot[0], slot[1] + 0.12] : [frontZ]

  return (
    <>
      {floors.map(([from, to]) => (
        <mesh key={from} position={[0, -0.25, (from + to) / 2]}>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, 0.5, to - from]} />
          {icy ? (
            <meshStandardMaterial color={PALETTE.ice} metalness={0.1} roughness={0.15} />
          ) : (
            <meshStandardMaterial color={PALETTE[floorTone]} />
          )}
        </mesh>
      ))}
      {slot && (
        <mesh position={[0, -1, (slot[0] + slot[1]) / 2]}>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, 0.1, slot[1] - slot[0]]} />
          <meshStandardMaterial color={PALETTE.spine} />
        </mesh>
      )}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (FIELD_HALF_WIDTH + 0.25), wallTop / 2, fieldMidZ]}>
          <boxGeometry args={[0.5, wallTop, fieldDepth]} />
          <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.12} />
        </mesh>
      ))}
      {/* Upper decks: slabs hanging just above the pusher below, out to the back. */}
      {layout.slice(1).map((deck, i) => {
        if (deck.floorY <= layout[i].floorY) return null
        const under = layout[i].floorY + PUSHER_HEIGHT + BACK_WALL_GAP
        const depth = deck.frontZ - backZ
        return (
          <mesh key={i} position={[0, (under + deck.floorY) / 2, backZ + depth / 2]}>
            <boxGeometry args={[FIELD_HALF_WIDTH * 2, deck.floorY - under, depth]} />
            <meshStandardMaterial color={PALETTE.floor} />
          </mesh>
        )
      })}
      {/* The back wall; a wall at the player's end is glass, so the table shows through. */}
      {openDecks(layout).map(deck => (
        <mesh
          key={deck.backZ}
          position={[0, wallBottom + wallHeight / 2, deck.backZ - deckDir(deck) * 0.25]}
        >
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, wallHeight, 0.5]} />
          {deck.pusher.reversed ? (
            <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.12} />
          ) : (
            <meshStandardMaterial color={PALETTE.backWall} />
          )}
        </mesh>
      ))}
      {edges.map(z => (
        <mesh key={z} position={[0, 0.005, z - 0.06]}>
          <boxGeometry args={[chuteHalfWidth * 2, 0.01, 0.12]} />
          <meshStandardMaterial
            color={PALETTE.chute}
            emissive={PALETTE.chute}
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
      {obstacles.map((o, i) => (
        <ObstacleMesh key={i} obstacle={o} />
      ))}
      {gutterWidth > 0 &&
        [-1, 1].map(side => (
          <mesh
            key={side}
            position={[side * (chuteHalfWidth + gutterWidth / 2), 0.005, frontZ - 0.06]}
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

const RIBBON = (() => {
  // A strip with a notched tail, hanging from the arm's crossbar.
  const shape = new THREE.Shape()
  shape.moveTo(-0.11, 0)
  shape.lineTo(0.11, 0)
  shape.lineTo(0.11, -1.3)
  shape.lineTo(0, -1.15)
  shape.lineTo(-0.11, -1.3)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
})()

/** The Bedtime Book's bookmark ribbon: marks the arm that drops next. */
function Ribbon() {
  return (
    <mesh geometry={RIBBON} position={[0.45, -ARM_LENGTH + 0.14, 0.16]}>
      <meshStandardMaterial color={PALETTE.ribbon} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Coins of height between a tower post's notches. */
const NOTCH_EVERY = 5
const NOTCHES = 3

/**
 * One obstacle, where it stands with the pusher at mid-stroke. A tower post
 * is stone, with a slim gauge behind it notched every five coins of height.
 */
function ObstacleMesh({ obstacle: o }: { obstacle: Obstacle }) {
  if (o.type === 'block') {
    return (
      <mesh position={[o.x, o.height / 2, o.z]}>
        <boxGeometry args={[o.width, o.height, o.depth]} />
        <meshStandardMaterial color={PALETTE.obstacle} />
      </mesh>
    )
  }
  const tower = o.tower !== undefined
  const gaugeTop = o.height + NOTCH_EVERY * NOTCHES * PUCK_THICKNESS
  return (
    <group position={[o.x, 0, o.z]}>
      <mesh position={[0, o.height / 2, 0]}>
        <cylinderGeometry args={[o.radius, o.radius, o.height, 24]} />
        <meshStandardMaterial
          color={tower ? PALETTE.stone : PALETTE.obstacle}
          roughness={tower ? 0.9 : 0.7}
        />
      </mesh>
      {tower && (
        <group position={[0, 0, -o.radius - 0.12]}>
          <mesh position={[0, gaugeTop / 2, 0]}>
            <boxGeometry args={[0.05, gaugeTop, 0.05]} />
            <meshStandardMaterial color={PALETTE.stone} />
          </mesh>
          {Array.from({ length: NOTCHES }, (_, k) => (
            <mesh key={k} position={[0, o.height + (k + 1) * NOTCH_EVERY * PUCK_THICKNESS, 0]}>
              <boxGeometry args={[0.3, 0.04, 0.06]} />
              <meshBasicMaterial color={PALETTE.cue} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

/** Keeps the camera fitted to the cabinet as the screen changes size. */
export function CabinetCamera({
  insets,
  layout,
  arm,
  cannon,
}: {
  insets: Insets
  layout: Layout
  arm: ArmConfig
  cannon?: CannonConfig
}) {
  const get = useThree(s => s.get)
  const size = useThree(s => s.size)

  useEffect(() => {
    fitCamera(
      get().camera as THREE.PerspectiveCamera,
      size.width,
      size.height,
      insets,
      keyPoints(layout, arm, cannon)
    )
  }, [get, size, insets, layout, arm, cannon])

  return null
}
