'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { FIELD_FRONT_Z } from '@/app/meteor-coins/lib/cabinet'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { COMET_BODY_RADIUS, COMET_BODY_Y } from '@/app/meteor-coins/lib/objects'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { usePrefersReducedMotion } from '@/app/meteor-coins/scene/reducedMotion'

/** Seconds for the comet's eyes to open as it wakes. */
const WAKE_S = 0.6
/** The comet looks happy this close to the lip, and once home. */
const NEARLY_HOME = 0.9
/** The dotted way home: one dot every this far, drawn just over the pile. */
const DOT_STEP = 0.4
const MAX_DOTS = 12
const DOT_Y = 0.75
/**
 * The HOME sign hangs on the cabinet's front under the middle of the lip;
 * once home, the comet waits off to one side of it, clear of the cannon.
 */
const SIGN_AT = new THREE.Vector3(0, -0.35, FIELD_FRONT_Z + 0.2)
const HOME_AT = new THREE.Vector3(-2.7, 0.1, FIELD_FRONT_Z + 0.7)

type Mood = 'asleep' | 'awake' | 'happy'

/** A point on the comet's round body, `up` and `across` radians from straight ahead. */
function onBody(up: number, across: number) {
  const dir = new THREE.Vector3(
    Math.sin(across) * Math.cos(up),
    Math.sin(up),
    Math.cos(across) * Math.cos(up)
  )
  return {
    position: dir
      .clone()
      .multiplyScalar(COMET_BODY_RADIUS)
      .add(new THREE.Vector3(0, COMET_BODY_Y, 0)),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir),
  }
}

/**
 * Comet Homecoming's comet, as a character: a face on the front of its
 * round body (it always faces the player, whichever way the body turns),
 * and a glowing tail streaming back the way it came. It sleeps through
 * Wake (closed eyes, a little "o" of a snore, Zzz), opens its eyes as
 * Orbit starts, and beams once it's nearly home and after.
 *
 * Also the way home: a HOME sign at the front edge, a dotted line from the
 * comet to it, and the comet itself waiting by the sign once it's home.
 * Reads the game every frame; owns no game state.
 */
export function CometRig({ game }: { game: DropGame }) {
  const reduced = usePrefersReducedMotion()
  const id = game.stage.lastPush?.object
  const index = useMemo(() => game.engine.pucks.findIndex(p => p.spec.id === id), [game, id])
  const onTable = useRef<THREE.Group>(null)
  const atHome = useRef<THREE.Group>(null)
  const faces = useRef<(FaceRefs | null)[]>([])
  const tail = useRef<THREE.Group>(null)
  const zzz = useRef<THREE.Sprite>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const woke = useRef<number | null>(null)
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) }),
    []
  )
  const zzzTexture = useMemo(() => labelTexture('z Z', PALETTE.cometTail, null), [])
  const signTexture = useMemo(() => labelTexture('HOME', PALETTE.background, PALETTE.cometHome), [])

  useFrame(() => {
    if (index < 0) return
    const puck = game.engine.pucks[index]
    const now = game.engine.time
    const awake = !game.stage.phases?.[game.phase]?.holdsLastPush
    if (awake && woke.current === null) woke.current = now
    if (!awake) woke.current = null
    // 0 shut, 1 open: the eyes open over a moment as it wakes.
    const open =
      woke.current === null ? 0 : reduced ? 1 : Math.min(1, (now - woke.current) / WAKE_S)
    const home = !puck.active
    const p = puck.body.translation()
    const nearlyHome = home || p.z > FIELD_FRONT_Z - NEARLY_HOME
    const mood: Mood = nearlyHome ? 'happy' : open > 0 ? 'awake' : 'asleep'

    if (onTable.current) {
      onTable.current.visible = !home
      onTable.current.position.set(p.x, p.y, p.z)
    }
    if (atHome.current) {
      atHome.current.visible = home
      const bob = reduced ? 0 : 0.08 * Math.sin(now * 2.4)
      atHome.current.position.set(HOME_AT.x, HOME_AT.y + bob, HOME_AT.z)
    }
    for (const face of faces.current) if (face) showMood(face, mood, open)
    // The tail streams out as it heads home: longest in the last phase.
    if (tail.current) {
      const homing = game.stage.phases?.[game.phase]?.homing !== undefined
      tail.current.scale.set(1, 1, mood === 'asleep' ? 0.55 : homing ? 1.3 : 0.9)
    }
    if (zzz.current) {
      zzz.current.visible = mood === 'asleep'
      const drift = reduced ? 0 : (now * 0.35) % 1
      zzz.current.position.set(0.55 + drift * 0.2, 1.45 + drift * 0.5, 0)
      zzz.current.material.opacity = reduced ? 0.9 : 0.9 * (1 - drift)
    }

    const mesh = dots.current
    if (mesh) {
      // From just in front of the comet straight to the lip.
      const fromZ = p.z + 1.1
      for (let i = 0; i < MAX_DOTS; i++) {
        const z = fromZ + i * DOT_STEP
        const show = !home && z < FIELD_FRONT_Z + 0.05
        mesh.setMatrixAt(i, show ? scratch.m.makeTranslation(p.x, DOT_Y, z) : scratch.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  if (index < 0) return null
  return (
    <>
      <group ref={onTable}>
        <Face
          refs={r => {
            faces.current[0] = r
          }}
        />
        <group ref={tail}>
          <Tail />
        </group>
        <sprite ref={zzz} scale={[0.7, 0.35, 1]} renderOrder={12}>
          <spriteMaterial map={zzzTexture} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* Home: it waits by the sign, beaming. */}
      <group ref={atHome} visible={false} scale={0.6}>
        <mesh position={[0, COMET_BODY_Y, 0]}>
          <sphereGeometry args={[COMET_BODY_RADIUS, 28, 20]} />
          <meshStandardMaterial
            color={PALETTE.core}
            emissive={PALETTE.core}
            emissiveIntensity={0.4}
          />
        </mesh>
        <Face
          refs={r => {
            faces.current[1] = r
          }}
        />
        <Tail />
      </group>

      <sprite position={SIGN_AT} scale={[1.3, 0.65, 1]}>
        <spriteMaterial map={signTexture} transparent />
      </sprite>
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
        renderOrder={10}
      >
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial color={PALETTE.cometHome} transparent opacity={0.9} depthTest={false} />
      </instancedMesh>
    </>
  )
}

type FaceRefs = {
  asleep: THREE.Object3D[]
  awake: THREE.Object3D[]
  happy: THREE.Object3D[]
  /** The open eyes, squashed shut while it wakes. */
  eyes: THREE.Object3D[]
}

function showMood(face: FaceRefs, mood: Mood, open: number) {
  for (const o of face.asleep) o.visible = mood === 'asleep'
  for (const o of face.awake) o.visible = mood === 'awake'
  for (const o of face.happy) o.visible = mood === 'happy'
  for (const o of face.eyes) o.scale.set(1, Math.max(0.1, open), 1)
}

const EYE_UP = 0.42
const EYE_ACROSS = 0.36

/**
 * The comet's face, on the front of its round body: eyes three ways
 * (asleep ◡ ◡, awake and round, happy ^ ^), a mouth to match, and pink
 * cheeks. Mood is shape, not only color.
 */
function Face({ refs }: { refs: (r: FaceRefs | null) => void }) {
  const at = useMemo(
    () => ({
      eyes: [-1, 1].map(side => onBody(EYE_UP, side * EYE_ACROSS)),
      cheeks: [-1, 1].map(side => onBody(0.22, side * 0.62)),
      mouth: onBody(0.12, 0),
    }),
    []
  )
  const face = useRef<FaceRefs>({ asleep: [], awake: [], happy: [], eyes: [] })
  const add = (key: keyof FaceRefs) => (o: THREE.Object3D | null) => {
    if (o && !face.current[key].includes(o)) face.current[key].push(o)
    refs(face.current)
  }
  return (
    <>
      {at.eyes.map((e, i) => (
        <group key={i} position={e.position} quaternion={e.quaternion}>
          {/* Asleep: shut, a curve down. */}
          <mesh ref={add('asleep')} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.085, 0.022, 8, 16, Math.PI]} />
            <meshBasicMaterial color={PALETTE.cometFace} />
          </mesh>
          {/* Awake: round eyes with a shine, opening as it wakes. */}
          <group ref={add('awake')}>
            <group ref={add('eyes')}>
              <mesh scale={[1, 1, 0.5]}>
                <sphereGeometry args={[0.1, 16, 12]} />
                <meshBasicMaterial color={PALETTE.cometFace} />
              </mesh>
              <mesh position={[0.03, 0.035, 0.05]}>
                <sphereGeometry args={[0.03, 8, 6]} />
                <meshBasicMaterial color={PALETTE.cometEye} />
              </mesh>
            </group>
          </group>
          {/* Happy: ^ ^ */}
          <mesh ref={add('happy')}>
            <torusGeometry args={[0.085, 0.024, 8, 16, Math.PI]} />
            <meshBasicMaterial color={PALETTE.cometFace} />
          </mesh>
        </group>
      ))}
      {at.cheeks.map((c, i) => (
        <mesh key={i} position={c.position} quaternion={c.quaternion} scale={[1, 0.6, 0.3]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshBasicMaterial color={PALETTE.cometCheek} transparent opacity={0.75} />
        </mesh>
      ))}
      <group position={at.mouth.position} quaternion={at.mouth.quaternion}>
        {/* Asleep: a small "o", snoring. */}
        <mesh ref={add('asleep')}>
          <torusGeometry args={[0.045, 0.018, 8, 16]} />
          <meshBasicMaterial color={PALETTE.cometFace} />
        </mesh>
        {/* Awake: a small smile. */}
        <mesh ref={add('awake')} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.09, 0.02, 8, 16, Math.PI]} />
          <meshBasicMaterial color={PALETTE.cometFace} />
        </mesh>
        {/* Happy: a big open grin. */}
        <mesh ref={add('happy')} rotation={[0, 0, Math.PI]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.14, 20, 0, Math.PI]} />
          <meshBasicMaterial color={PALETTE.cometFace} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  )
}

/** Three soft cones streaming back from the body, the way the comet came. */
function Tail() {
  return (
    <>
      {[
        { x: 0, y: 0.55, length: 1.7, radius: 0.5, opacity: 0.35 },
        { x: -0.3, y: 0.35, length: 1.2, radius: 0.3, opacity: 0.3 },
        { x: 0.3, y: 0.35, length: 1.2, radius: 0.3, opacity: 0.3 },
      ].map((t, i) => (
        <mesh
          key={i}
          position={[t.x, t.y, -COMET_BODY_RADIUS * 0.6 - t.length / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[t.radius, t.length, 20, 1, true]} />
          <meshBasicMaterial
            color={PALETTE.cometTail}
            transparent
            opacity={t.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  )
}

/** A word on a rounded tag (or bare, with no `fill`), drawn on a canvas: no font files to load. */
function labelTexture(text: string, ink: string, fill: string | null): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    if (fill) {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.roundRect(8, 20, 240, 88, 44)
      ctx.fill()
    }
    ctx.fillStyle = ink
    ctx.font = 'bold 58px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 66)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
