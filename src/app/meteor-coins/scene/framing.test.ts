import * as THREE from 'three'

import { type Insets, fitCamera, keyPoints } from './framing'

const INSETS: Insets = { top: 76, bottom: 52, side: 12 }

function projectedBounds(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera()
  fitCamera(camera, width, height, INSETS)
  const ys: number[] = []
  const xs: number[] = []
  for (const point of keyPoints()) {
    const p = point.clone().project(camera)
    // NDC → CSS pixels from the top-left.
    xs.push(((p.x + 1) / 2) * width)
    ys.push(((1 - p.y) / 2) * height)
  }
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}

describe('fitCamera', () => {
  const screens: [string, number, number][] = [
    ['phone', 390, 844],
    ['small phone', 375, 667],
    ['landscape phone', 844, 390],
    ['desktop', 1280, 800],
    ['ultrawide', 2560, 1080],
  ]

  it.each(screens)('keeps the table, edge, arm and ring clear of the HUD on a %s', (_, w, h) => {
    const b = projectedBounds(w, h)
    expect(b.top).toBeGreaterThanOrEqual(INSETS.top - 1)
    expect(b.bottom).toBeLessThanOrEqual(h - INSETS.bottom + 1)
    expect(b.left).toBeGreaterThanOrEqual(INSETS.side - 1)
    expect(b.right).toBeLessThanOrEqual(w - INSETS.side + 1)
  })

  it.each(screens)('uses most of the free space on a %s', (_, w, h) => {
    const b = projectedBounds(w, h)
    const fillsWidth = (b.right - b.left) / (w - 2 * INSETS.side)
    const fillsHeight = (b.bottom - b.top) / (h - INSETS.top - INSETS.bottom)
    expect(Math.max(fillsWidth, fillsHeight)).toBeGreaterThan(0.97)
  })
})
