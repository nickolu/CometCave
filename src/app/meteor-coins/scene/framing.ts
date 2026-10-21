import * as THREE from 'three'

import {
  CLASSIC_LAYOUT,
  FIELD_FRONT_Z,
  FIELD_HALF_WIDTH,
  type Layout,
  PUSHER_HEIGHT,
  openDecks,
  slotOf,
} from '@/app/meteor-coins/lib/cabinet'
import {
  ARM_LENGTH,
  ARM_MAX_ANGLE,
  ARM_PERIOD_S,
  ARM_PIVOT_Y,
  type ArmConfig,
  RING_Y,
  dropLines,
} from '@/app/meteor-coins/lib/dropper'

/**
 * Fits the camera to the cabinet on any screen shape.
 *
 * Hand-picked camera positions per orientation left the table tiny on tall
 * phones, cut off the front edge on landscape phones, and put the arm under
 * the score box. Instead: keep a fixed viewing angle (steeper on portrait,
 * where there's spare height), then solve for the distance and aim that put
 * every point that matters inside the part of the screen the HUD leaves free.
 */

/** Space the HUD covers, in CSS pixels. */
export type Insets = { top: number; bottom: number; side: number }

const VERTICAL_FOV = 40
const PORTRAIT_ELEVATION = (54 * Math.PI) / 180
const LANDSCAPE_ELEVATION = (40 * Math.PI) / 180

/** What the player must always see: the whole table, the scoring edge, the arm's full swing and the ring. */
export function keyPoints(
  layout: Layout = CLASSIC_LAYOUT,
  arm: ArmConfig = { periodS: ARM_PERIOD_S }
): THREE.Vector3[] {
  const w = FIELD_HALF_WIDTH + 0.5
  const pivotY = arm.pivotY ?? ARM_PIVOT_Y
  const edgeTipY = pivotY - ARM_LENGTH * Math.cos(ARM_MAX_ANGLE)
  const tipX = ARM_LENGTH * Math.sin(ARM_MAX_ANGLE)
  const centerTipY = pivotY - ARM_LENGTH
  return [
    // Front edge and chute, slightly below the table top so the lip shows.
    // (A table that drops into a slot in the middle has no front edge.)
    ...(slotOf(layout)
      ? []
      : [
          new THREE.Vector3(-w, -0.3, FIELD_FRONT_Z + 0.3),
          new THREE.Vector3(w, -0.3, FIELD_FRONT_Z + 0.3),
        ]),
    // Each wall where it meets the playfield, above the pusher: the back
    // wall, and the front one where a deck faces away.
    ...openDecks(layout).flatMap(deck => [
      new THREE.Vector3(-w, deck.floorY + PUSHER_HEIGHT, deck.backZ),
      new THREE.Vector3(w, deck.floorY + PUSHER_HEIGHT, deck.backZ),
    ]),
    // Arm tip with a coin's headroom, at both ends of the swing and the bottom of the arc.
    ...dropLines(arm).flatMap(dropZ => [
      new THREE.Vector3(-tipX, edgeTipY + 0.6, dropZ),
      new THREE.Vector3(tipX, edgeTipY + 0.6, dropZ),
      new THREE.Vector3(0, centerTipY + 0.6, dropZ),
      new THREE.Vector3(0, RING_Y, dropZ),
    ]),
  ]
}

export function fitCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  insets: Insets,
  points: THREE.Vector3[] = keyPoints()
) {
  const aspect = width / height
  const elevation = aspect < 1 ? PORTRAIT_ELEVATION : LANDSCAPE_ELEVATION
  const back = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation))

  // Safe rectangle in normalized device coordinates (-1…1).
  const safe = {
    xMin: -1 + (2 * insets.side) / width,
    xMax: 1 - (2 * insets.side) / width,
    yMin: -1 + (2 * insets.bottom) / height,
    yMax: 1 - (2 * insets.top) / height,
  }
  const safeW = safe.xMax - safe.xMin
  const safeH = safe.yMax - safe.yMin

  camera.fov = VERTICAL_FOV
  camera.aspect = aspect
  camera.near = 0.1
  camera.far = 200

  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3())
  let distance = 25
  const p = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()

  // Perspective makes fit nonlinear, so refine: scale distance to fit the
  // safe rectangle, then slide the aim so the content is centered in it.
  for (let i = 0; i < 12; i++) {
    camera.position.copy(target).addScaledVector(back, distance)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    for (const point of points) {
      p.copy(point).project(camera)
      xMin = Math.min(xMin, p.x)
      xMax = Math.max(xMax, p.x)
      yMin = Math.min(yMin, p.y)
      yMax = Math.max(yMax, p.y)
    }

    const scale = Math.max((xMax - xMin) / safeW, (yMax - yMin) / safeH)
    const halfH = distance * Math.tan(THREE.MathUtils.degToRad(VERTICAL_FOV / 2))
    const halfW = halfH * aspect
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    const dx = ((xMin + xMax) / 2 - (safe.xMin + safe.xMax) / 2) * halfW
    const dy = ((yMin + yMax) / 2 - (safe.yMin + safe.yMax) / 2) * halfH
    target.addScaledVector(right, dx).addScaledVector(up, dy)
    distance *= scale
  }

  camera.position.copy(target).addScaledVector(back, distance)
  camera.lookAt(target)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}
