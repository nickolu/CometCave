'use client'

import { useFrame, useThree } from '@react-three/fiber'
import {
  CuboidCollider,
  CylinderCollider,
  InstancedRigidBodies,
  type InstancedRigidBodyProps,
  type IntersectionEnterPayload,
  type RapierRigidBody,
  RigidBody,
  useBeforePhysicsStep,
} from '@react-three/rapier'
import { type Ref, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_GAP,
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  DROP_Y,
  DROP_Z,
  FIELD_BACK_Z,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  PHYSICS_STEP_S,
  PUCK_RADIUS,
  PUCK_THICKNESS,
  PUSHER_DEPTH,
  PUSHER_HEIGHT,
  type PuckShape,
  SQUARE_SIDE,
  WALL_HEIGHT,
  clampAim,
  classifyFall,
  pusherCenterZ,
  seedPile,
} from '@/app/coin-pusher/lib/cabinet'
import { PALETTE } from '@/app/coin-pusher/scene/palette'

/**
 * Every puck that can ever exist is created up front and parked, disabled,
 * far below the cabinet. Dropping a puck wakes one from the pool; a puck that
 * falls off the front goes back to it. Creating and destroying bodies mid-game
 * would rebuild the instanced mesh and stall; a pool also caps the live count.
 *
 * The cap is the performance budget. A random pile doesn't reliably sleep
 * (Rapier sleeps a touching group only when all of it is still), so assume
 * every puck is awake: measured ~1.5ms/step at 200 and ~2.8ms at 300 on an
 * M-series Mac. 250 leaves a phone headroom inside a 16ms frame. Forcing
 * individual pucks to sleep was tried and rejected — it left pucks floating
 * when the pile under them was pushed away.
 */
export const POOL_SIZE = 250
const SEED_FLOOR_LAYERS = 4
const PARK_Y = -50

export type CabinetStats = {
  live: number
  asleep: number
  scored: number
  lost: number
}

export type CabinetHandle = {
  drop: (count?: number) => void
  stats: () => CabinetStats
}

const PUCK_MATERIAL = { friction: 0.6, restitution: 0.05 }

export function Cabinet({
  shape,
  aimRef,
  ref,
}: {
  shape: PuckShape
  aimRef: React.RefObject<number>
  ref: Ref<CabinetHandle>
}) {
  const bodies = useRef<(RapierRigidBody | null)[] | null>(null)
  const pusher = useRef<RapierRigidBody>(null)
  const ghost = useRef<THREE.Mesh>(null)

  const free = useRef<number[]>([])
  const handleToIndex = useRef(new Map<number, number>())
  const fallen = useRef<number[]>([])
  const pendingDrops = useRef(0)
  const counts = useRef({ scored: 0, lost: 0 })
  const elapsed = useRef(0)

  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    const pile = seedPile(SEED_FLOOR_LAYERS)
    return Array.from({ length: POOL_SIZE }, (_, i) => ({
      key: i,
      position: pile[i] ?? [i * 2, PARK_Y, 0],
      rotation: shape === 'square' ? [0, (i * 0.7) % Math.PI, 0] : [0, 0, 0],
    }))
  }, [shape])

  const seeded = useMemo(() => seedPile(SEED_FLOOR_LAYERS).length, [])

  useEffect(() => {
    const list = bodies.current
    if (!list) return
    handleToIndex.current.clear()
    free.current = []
    list.forEach((rb, i) => {
      if (!rb) return
      handleToIndex.current.set(rb.handle, i)
      if (i >= seeded) {
        rb.setEnabled(false)
        free.current.push(i)
      }
    })
  }, [instances, seeded])

  function park(i: number) {
    const rb = bodies.current?.[i]
    if (!rb) return
    rb.setEnabled(false)
    rb.setLinvel({ x: 0, y: 0, z: 0 }, false)
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false)
    rb.setTranslation({ x: i * 2, y: PARK_Y, z: 0 }, false)
    free.current.push(i)
  }

  function spawn() {
    const i = free.current.pop()
    if (i === undefined) return false
    const rb = bodies.current?.[i]
    if (!rb) return false
    // A little scatter so a burst of drops doesn't spawn pucks inside each other.
    const x = clampAim(aimRef.current + (Math.random() - 0.5) * 0.3)
    rb.setTranslation({ x, y: DROP_Y + Math.random() * 0.4, z: DROP_Z }, false)
    rb.setRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, Math.random() * Math.PI, 0)),
      false
    )
    rb.setLinvel({ x: 0, y: -2, z: 0 }, false)
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false)
    rb.setEnabled(true)
    rb.wakeUp()
    return true
  }

  useImperativeHandle(ref, () => ({
    drop: (count = 1) => {
      pendingDrops.current += count
    },
    stats: () => {
      let live = 0
      let asleep = 0
      bodies.current?.forEach(rb => {
        if (!rb || !rb.isEnabled()) return
        live++
        if (rb.isSleeping()) asleep++
      })
      return { live, asleep, ...counts.current }
    },
  }))

  useBeforePhysicsStep(() => {
    elapsed.current += PHYSICS_STEP_S
    pusher.current?.setNextKinematicTranslation({
      x: 0,
      y: PUSHER_HEIGHT / 2,
      z: pusherCenterZ(elapsed.current),
    })

    // Collision events fire mid-step, so state changes wait for the next one.
    for (const i of fallen.current) park(i)
    fallen.current = []

    // One drop per step so a burst arrives as a stream, not an explosion.
    if (pendingDrops.current > 0) {
      if (spawn()) pendingDrops.current--
      else pendingDrops.current = 0
    }
  })

  function onFall({ other }: IntersectionEnterPayload) {
    const rb = other.rigidBody
    if (!rb) return
    const i = handleToIndex.current.get(rb.handle)
    if (i === undefined || fallen.current.includes(i)) return
    const result = classifyFall(rb.translation().x)
    if (result === 'chute') counts.current.scored++
    else counts.current.lost++
    fallen.current.push(i)
  }

  useFrame(() => {
    ghost.current?.position.set(aimRef.current, DROP_Y, DROP_Z)
  })

  const fieldDepth = FIELD_FRONT_Z - FIELD_BACK_Z
  const fieldMidZ = (FIELD_BACK_Z + FIELD_FRONT_Z) / 2
  const backWallBottom = PUSHER_HEIGHT + BACK_WALL_GAP
  const backWallHeight = WALL_HEIGHT + 2 - backWallBottom

  return (
    <>
      {/* Floor */}
      <RigidBody type="fixed" colliders={false} friction={0.4}>
        <CuboidCollider
          args={[FIELD_HALF_WIDTH, 0.25, fieldDepth / 2]}
          position={[0, -0.25, fieldMidZ]}
        />
        <mesh position={[0, -0.25, fieldMidZ]}>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, 0.5, fieldDepth]} />
          <meshStandardMaterial color={PALETTE.floor} />
        </mesh>
      </RigidBody>

      {/* Side walls — clear so the pile stays visible from any angle */}
      {[-1, 1].map(side => (
        <RigidBody key={side} type="fixed" colliders={false} friction={0.2}>
          <CuboidCollider
            args={[0.25, WALL_HEIGHT / 2, fieldDepth / 2]}
            position={[side * (FIELD_HALF_WIDTH + 0.25), WALL_HEIGHT / 2, fieldMidZ]}
          />
          <mesh position={[side * (FIELD_HALF_WIDTH + 0.25), WALL_HEIGHT / 2, fieldMidZ]}>
            <boxGeometry args={[0.5, WALL_HEIGHT, fieldDepth]} />
            <meshStandardMaterial color={PALETTE.glassWall} transparent opacity={0.12} />
          </mesh>
        </RigidBody>
      ))}

      {/* Back wall — hangs just above the pusher top to scrape riders off */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[FIELD_HALF_WIDTH, backWallHeight / 2, 0.25]}
          position={[0, backWallBottom + backWallHeight / 2, BACK_WALL_Z - 0.25]}
        />
        <mesh position={[0, backWallBottom + backWallHeight / 2, BACK_WALL_Z - 0.25]}>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, backWallHeight, 0.5]} />
          <meshStandardMaterial color={PALETTE.backWall} />
        </mesh>
      </RigidBody>

      {/* Pusher — scripted motion, infinite mass; nothing pushes back on it */}
      <RigidBody
        ref={pusher}
        type="kinematicPosition"
        colliders={false}
        position={[0, PUSHER_HEIGHT / 2, pusherCenterZ(0)]}
        friction={0.5}
      >
        <CuboidCollider
          args={[FIELD_HALF_WIDTH - 0.02, PUSHER_HEIGHT / 2 - 0.005, PUSHER_DEPTH / 2]}
        />
        <mesh>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2 - 0.04, PUSHER_HEIGHT - 0.01, PUSHER_DEPTH]} />
          <meshStandardMaterial color={PALETTE.pusher} />
        </mesh>
      </RigidBody>

      {/* Front edge markers: chute in the middle, gutters at the sides */}
      <mesh position={[0, 0.005, FIELD_FRONT_Z - 0.06]}>
        <boxGeometry args={[CHUTE_HALF_WIDTH * 2, 0.01, 0.12]} />
        <meshStandardMaterial
          color={PALETTE.chute}
          emissive={PALETTE.chute}
          emissiveIntensity={0.6}
        />
      </mesh>
      {[-1, 1].map(side => {
        const width = FIELD_HALF_WIDTH - CHUTE_HALF_WIDTH
        return (
          <mesh
            key={side}
            position={[side * (CHUTE_HALF_WIDTH + width / 2), 0.005, FIELD_FRONT_Z - 0.06]}
          >
            <boxGeometry args={[width, 0.01, 0.12]} />
            <meshStandardMaterial
              color={PALETTE.gutter}
              emissive={PALETTE.gutter}
              emissiveIntensity={0.4}
            />
          </mesh>
        )
      })}

      {/* Catch sensor below the front edge — anything entering has fallen off */}
      <CuboidCollider
        sensor
        args={[FIELD_HALF_WIDTH + 2, 0.5, 2]}
        position={[0, -3, FIELD_FRONT_Z + 2]}
        onIntersectionEnter={onFall}
      />

      {/* Pucks */}
      <InstancedRigidBodies
        ref={bodies}
        instances={instances}
        colliders={false}
        colliderNodes={[
          shape === 'round' ? (
            <CylinderCollider key="c" args={[PUCK_THICKNESS / 2, PUCK_RADIUS]} {...PUCK_MATERIAL} />
          ) : (
            <CuboidCollider
              key="c"
              args={[SQUARE_SIDE / 2, PUCK_THICKNESS / 2, SQUARE_SIDE / 2]}
              {...PUCK_MATERIAL}
            />
          ),
        ]}
        linearDamping={0.1}
        angularDamping={0.4}
        ccd
      >
        <instancedMesh args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
          {shape === 'round' ? (
            <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 28]} />
          ) : (
            <boxGeometry args={[SQUARE_SIDE, PUCK_THICKNESS, SQUARE_SIDE]} />
          )}
          <meshStandardMaterial color={PALETTE.puck} metalness={0.35} roughness={0.35} />
        </instancedMesh>
      </InstancedRigidBodies>

      {/* Aim ghost */}
      <mesh ref={ghost} position={[0, DROP_Y, DROP_Z]}>
        {shape === 'round' ? (
          <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 28]} />
        ) : (
          <boxGeometry args={[SQUARE_SIDE, PUCK_THICKNESS, SQUARE_SIDE]} />
        )}
        <meshStandardMaterial color={PALETTE.puck} transparent opacity={0.35} />
      </mesh>
    </>
  )
}

/**
 * Points the camera from where a player would stand at the machine. On a
 * portrait screen the vertical field of view widens so the full cabinet width
 * still fits.
 */
export function CabinetCamera() {
  const get = useThree(s => s.get)
  const size = useThree(s => s.size)

  useEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const minHorizontalFov = (56 * Math.PI) / 180
    const fitWidth = (2 * Math.atan(Math.tan(minHorizontalFov / 2) / aspect) * 180) / Math.PI
    camera.fov = Math.max(42, fitWidth)
    // Tall screens have spare height, so look down more steeply and let the
    // field's depth run up the screen instead of shrinking the whole cabinet.
    if (aspect < 1) camera.position.set(0, 13, 6.5)
    else camera.position.set(0, 9.5, 10.5)
    camera.lookAt(0, 0, -0.8)
    camera.updateProjectionMatrix()
  }, [get, size])

  return null
}

/**
 * Pointer and keyboard aiming. The pointer ray is intersected with the
 * vertical plane pucks drop through, so the ghost sits exactly under the
 * finger at any screen shape. Pressing (mouse or touch) drops a puck there.
 */
export function AimInput({
  aimRef,
  onDrop,
}: {
  aimRef: React.RefObject<number>
  onDrop: () => void
}) {
  const { camera, gl } = useThree()

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DROP_Z)
    const hit = new THREE.Vector3()
    const ndc = new THREE.Vector2()

    function aimAt(e: PointerEvent) {
      const rect = el.getBoundingClientRect()
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) aimRef.current = clampAim(hit.x)
    }
    function onMove(e: PointerEvent) {
      aimAt(e)
    }
    function onDown(e: PointerEvent) {
      aimAt(e)
      onDrop()
    }
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return
      if (e.key === 'ArrowLeft') aimRef.current = clampAim(aimRef.current - 0.25)
      else if (e.key === 'ArrowRight') aimRef.current = clampAim(aimRef.current + 0.25)
      else if (e.key === ' ') onDrop()
      else return
      e.preventDefault()
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [camera, gl, aimRef, onDrop])

  return null
}
