import {
  BACK_WALL_Z,
  CHUTE_HALF_WIDTH,
  CLASSIC_LAYOUT,
  FIELD_BACK_Z,
  type Layout,
  PUSHER_AMP_Z,
  PUSHER_DEPTH,
  PUSHER_MID_Z,
  classifyFall,
  deckPusherZ,
  fieldBackZ,
  pusherCenterZ,
} from './cabinet'
import { type StageDef, playableStage } from './stages'

describe('cabinet geometry', () => {
  it('keeps the back of the pusher behind the back wall at full extension', () => {
    // Otherwise a gap opens behind the pusher and pucks fall into it.
    const backAtFullExtension = PUSHER_MID_Z + PUSHER_AMP_Z - PUSHER_DEPTH / 2
    expect(backAtFullExtension).toBeLessThanOrEqual(BACK_WALL_Z)
  })

  it('never pulls the back of the pusher past the back of the floor', () => {
    const backAtFullRetraction = PUSHER_MID_Z - PUSHER_AMP_Z - PUSHER_DEPTH / 2
    expect(backAtFullRetraction).toBeGreaterThanOrEqual(FIELD_BACK_Z)
  })

  it('sweeps the pusher between its two extremes', () => {
    const samples = Array.from({ length: 400 }, (_, i) => pusherCenterZ(i / 100))
    expect(Math.min(...samples)).toBeCloseTo(PUSHER_MID_Z - PUSHER_AMP_Z, 2)
    expect(Math.max(...samples)).toBeCloseTo(PUSHER_MID_Z + PUSHER_AMP_Z, 2)
  })
})

describe('classifyFall', () => {
  it('scores the middle of the front edge and loses the sides', () => {
    expect(classifyFall(0)).toBe('chute')
    expect(classifyFall(CHUTE_HALF_WIDTH)).toBe('chute')
    expect(classifyFall(-CHUTE_HALF_WIDTH - 0.01)).toBe('gutter')
    expect(classifyFall(3.5)).toBe('gutter')
  })
})

describe('deck layouts', () => {
  it('keeps the classic table exactly as it was', () => {
    for (const t of [0, 0.4, 1.7, 3.1]) {
      expect(deckPusherZ(CLASSIC_LAYOUT[0], t)).toBe(pusherCenterZ(t))
    }
    expect(fieldBackZ(CLASSIC_LAYOUT)).toBe(FIELD_BACK_Z)
  })

  it('stacks The Cascade Engine so each deck spills onto the pusher below', () => {
    const layout = (playableStage('the-cascade-engine') as StageDef).table.layout as Layout
    for (let i = 1; i < layout.length; i++) {
      const below = layout[i - 1]
      const faceMin = below.pusher.midZ - below.pusher.ampZ + below.pusher.depth / 2
      // The upper edge overhangs the lower pusher's top, even pulled back…
      expect(layout[i].frontZ).toBe(below.backZ)
      expect(below.backZ).toBeLessThan(faceMin)
      // …and the lower pusher's back end never comes out from under it.
      expect(below.pusher.midZ + below.pusher.ampZ - below.pusher.depth / 2).toBeLessThan(
        layout[i].frontZ
      )
    }
  })
})
