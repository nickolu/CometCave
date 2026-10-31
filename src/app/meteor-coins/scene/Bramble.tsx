'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { FIELD_FRONT_Z, FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** One chomp: the mouth shuts and opens again, and the eyes squint happily. */
const CHOMP_S = 0.45
/** How long the "Yum!" tag stays up after a feed. */
const YUM_S = 0.9
/** The body: a round, soft blob under the counter, as wide as its mouth. */
const BODY = { y: -1.3, z: FIELD_FRONT_Z + 1.0, size: [1.5, 1.1, 1.05] as const }
/** The open mouth, on top of the body just in front of the lip, where chocolates fall. */
const MOUTH = { y: -0.24, z: FIELD_FRONT_Z + 0.75 }
/** Eyes on short stalks either side of the mouth, peeking just over the lip. */
const EYE = { x: 1.15, y: 0.22, z: FIELD_FRONT_Z + 0.6, radius: 0.28 }

/** Whether the player has asked for less motion. Decorative motion is held still if so. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Bramble: a big, polite monster who lives under the bakery counter, its
 * mouth open across part of the front edge. It follows the stage's
 * roaming chute (engine.chuteX), so only chocolates pushed off over its
 * mouth go in. When fed it chomps — the mouth shuts, the eyes squint shut
 * into happy arcs, and a "Yum!" tag pops up — so a feed shows by shape and
 * words, not by colour or sound. Its eyes look the way it's heading. The
 * edge markings are drawn here too: the lit stretch of the lip is its mouth.
 */
export function Bramble({ game }: { game: DropGame }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Group>(null)
  const eyes = useRef<(THREE.Group | null)[]>([])
  const shut = useRef<(THREE.Group | null)[]>([])
  const pupils = useRef<(THREE.Mesh | null)[]>([])
  const yum = useRef<THREE.Sprite>(null)
  const chute = useRef<THREE.Mesh>(null)
  const still = useMemo(() => prefersReducedMotion(), [])
  const yumLabel = useMemo(() => yumTexture(), [])
  const fed = useRef({ score: game.state.score, at: -Infinity })
  const half = game.engine.chuteHalfWidth

  useFrame(() => {
    const engine = game.engine
    const x = engine.chuteX()
    root.current?.position.set(x, 0, 0)
    chute.current?.position.set(x, 0.008, FIELD_FRONT_Z - 0.06)

    const score = game.state.score
    const f = fed.current
    if (score > f.score) f.at = engine.time
    f.score = score
    const since = engine.time - f.at

    // The chomp: shut and open again, as a smooth bump.
    const k = since < CHOMP_S ? Math.sin((Math.PI * since) / CHOMP_S) : 0
    mouth.current?.scale.set(1, 1, 1 - 0.85 * k)
    const happy = since < CHOMP_S + 0.25
    for (const eye of eyes.current) if (eye) eye.visible = !happy
    for (const lid of shut.current) if (lid) lid.visible = happy
    // Look the way the mouth is heading.
    const sweep = engine.chuteSweep
    const heading = sweep ? Math.cos((2 * Math.PI * engine.time) / sweep.periodS) : 0
    for (const pupil of pupils.current) {
      if (!pupil) continue
      pupil.position.x = 0.1 * heading
    }
    if (yum.current) {
      yum.current.visible = since < YUM_S
      yum.current.position.y = 1 + (still ? 0 : 0.4 * Math.min(1, since / YUM_S))
    }
    // Breathing, and a little bounce on each chomp; held still for reduced motion.
    const breathe = still ? 0 : 0.03 * Math.sin(engine.time * 2.2)
    const squash = still ? 0 : 0.06 * k
    body.current?.scale.set(1 + squash, 1 + breathe - squash, 1 + squash)
  })

  return (
    <>
      {/* The front edge: the whole lip is floor, except the stretch over Bramble's mouth. */}
      <mesh position={[0, 0.005, FIELD_FRONT_Z - 0.06]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2, 0.01, 0.12]} />
        <meshStandardMaterial
          color={PALETTE.gutter}
          emissive={PALETTE.gutter}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh ref={chute}>
        <boxGeometry args={[half * 2, 0.014, 0.14]} />
        <meshStandardMaterial
          color={PALETTE.chute}
          emissive={PALETTE.chute}
          emissiveIntensity={0.6}
        />
      </mesh>

      <group ref={root}>
        <group ref={body} position={[0, BODY.y, BODY.z]}>
          <mesh scale={BODY.size}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color={PALETTE.bramble} roughness={0.95} />
          </mesh>
          {/* A paler tummy on the front. */}
          <mesh position={[0, -0.2, 0.75]} scale={[0.95, 0.85, 0.5]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color={PALETTE.brambleBelly} roughness={0.95} />
          </mesh>
          {[-1, 1].map(side => (
            <mesh key={side} position={[side * 0.95, 0.5, 0.9]} scale={[0.25, 0.14, 0.1]}>
              <sphereGeometry args={[1, 16, 10]} />
              <meshStandardMaterial color={PALETTE.brambleCheek} roughness={0.9} />
            </mesh>
          ))}
        </group>

        {/* The mouth, open wide and facing up, with a tongue and two front teeth. */}
        <group ref={mouth} position={[0, MOUTH.y, MOUTH.z]} rotation={[-Math.PI / 2 + 0.25, 0, 0]}>
          <mesh scale={[half - 0.05, 0.55, 1]}>
            <circleGeometry args={[1, 40]} />
            <meshStandardMaterial color={PALETTE.brambleMouth} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.22, 0.01]} scale={[0.6, 0.22, 1]}>
            <circleGeometry args={[1, 28]} />
            <meshStandardMaterial color={PALETTE.brambleTongue} side={THREE.DoubleSide} />
          </mesh>
          {/* Lips: a soft rim round the mouth. */}
          <mesh scale={[half - 0.05, 0.55, 1]}>
            <torusGeometry args={[1, 0.08, 8, 48]} />
            <meshStandardMaterial color={PALETTE.bramble} roughness={0.95} />
          </mesh>
          {[-0.18, 0.18].map(tx => (
            <mesh key={tx} position={[tx, 0.42, 0.04]}>
              <boxGeometry args={[0.26, 0.2, 0.06]} />
              <meshStandardMaterial color={PALETTE.tooth} />
            </mesh>
          ))}
        </group>

        {/* Eyes on short stalks, either side of the mouth. */}
        {[-1, 1].map((side, i) => (
          <group key={side} position={[side * EYE.x, 0, EYE.z]}>
            <mesh position={[0, (EYE.y - 0.8) / 2, 0.15]}>
              <cylinderGeometry args={[0.1, 0.16, EYE.y + 0.8, 12]} />
              <meshStandardMaterial color={PALETTE.bramble} roughness={0.95} />
            </mesh>
            <group
              ref={g => {
                eyes.current[i] = g
              }}
              position={[0, EYE.y, 0.15]}
            >
              <mesh>
                <sphereGeometry args={[EYE.radius, 20, 14]} />
                <meshStandardMaterial color={PALETTE.brambleEye} roughness={0.4} />
              </mesh>
              <mesh
                ref={m => {
                  pupils.current[i] = m
                }}
                position={[0, 0.05, EYE.radius * 0.8]}
              >
                <sphereGeometry args={[EYE.radius * 0.45, 16, 10]} />
                <meshStandardMaterial color={PALETTE.bramblePupil} roughness={0.3} />
              </mesh>
            </group>
            {/* Shut tight with joy: a furry lid with a happy upturned arc on it. */}
            <group
              ref={g => {
                shut.current[i] = g
              }}
              position={[0, EYE.y, 0.15]}
              visible={false}
            >
              <mesh>
                <sphereGeometry args={[EYE.radius, 20, 14]} />
                <meshStandardMaterial color={PALETTE.bramble} roughness={0.95} />
              </mesh>
              <mesh position={[0, -0.04, EYE.radius * 0.92]} rotation={[-0.35, 0, 0]}>
                <torusGeometry args={[EYE.radius * 0.55, 0.045, 8, 20, Math.PI]} />
                <meshStandardMaterial color={PALETTE.bramblePupil} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Paws resting politely on the counter, at the edges of its mouth. */}
        {[-1, 1].map(side => (
          <mesh
            key={side}
            position={[side * (half + 0.2), 0.02, FIELD_FRONT_Z + 0.12]}
            scale={[0.32, 0.14, 0.26]}
          >
            <sphereGeometry args={[1, 16, 10]} />
            <meshStandardMaterial color={PALETTE.bramble} roughness={0.95} />
          </mesh>
        ))}

        <sprite ref={yum} position={[0, 1, MOUTH.z + 0.6]} scale={[1.6, 0.8, 1]} renderOrder={12}>
          <spriteMaterial map={yumLabel} transparent depthTest={false} />
        </sprite>
      </group>
    </>
  )
}

/** The "Yum!" tag, drawn on a canvas: no font files to load. */
function yumTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.brambleEye
    ctx.beginPath()
    ctx.roundRect(16, 16, 224, 96, 48)
    ctx.fill()
    ctx.fillStyle = PALETTE.brambleMouth
    ctx.font = 'bold 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Yum!', 128, 68)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
