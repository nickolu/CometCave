import { beforeAll, describe, expect, it } from 'vitest'

import { PHYSICS_STEP_S } from '@/app/meteor-coins/lib/cabinet'
import {
  SlideDelivery,
  rideRotation,
  rideSpeed,
  slideCurve,
  slideExit,
  slideFlight,
  slideYaw,
} from '@/app/meteor-coins/lib/deliveries/slide'
import { initPhysics } from '@/app/meteor-coins/lib/engine'
import { DropGame } from '@/app/meteor-coins/lib/game'
import { playableStage } from '@/app/meteor-coins/lib/stages'

const stage = playableStage('rubber-ducky-rumble')!
const config = (() => {
  const d = stage.delivery
  if (d?.kind !== 'slide') throw new Error('Rubber Ducky Rumble rides the waterslide')
  return d
})()

describe('the waterslide', () => {
  it('runs from its top down to its lip', () => {
    const { points, along } = slideCurve(config)
    expect(points[0]).toEqual({ forward: 0, y: config.pivot.y })
    expect(points[points.length - 1]).toEqual(config.lip)
    expect(along.every((d, i) => i === 0 || d > along[i - 1])).toBe(true)
  })

  it('sways both ways, no further than its reach', () => {
    const yaws = Array.from({ length: 200 }, (_, i) => slideYaw((i / 200) * config.periodS, config))
    expect(Math.max(...yaws)).toBeCloseTo(config.maxYaw, 2)
    expect(Math.min(...yaws)).toBeCloseTo(-config.maxYaw, 2)
  })

  it('shoots a duck out faster than it went in, aimed where it points', () => {
    const { velocity } = slideExit(0.3, config)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(
      rideSpeed(config.pivot.y - config.lip.y, config)
    )
    expect(rideSpeed(config.pivot.y - config.lip.y, config)).toBeGreaterThan(config.startSpeed)
    expect(Math.atan2(velocity.x, velocity.z)).toBeCloseTo(0.3)
  })

  it('turns a duck so its beak points down the slope', () => {
    // The beak is the duck's +x; rotate it by the quaternion.
    const q = rideRotation(0, 0)
    const x = 1 - 2 * (q.y * q.y + q.z * q.z)
    const z = 2 * (q.x * q.z - q.w * q.y)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(1)
  })

  describe('in play', () => {
    beforeAll(() => initPhysics())

    it('rides a duck down and lets it go where the preview says', () => {
      const game = new DropGame(stage)
      const slide = game.delivery as SlideDelivery
      expect(slide.kind).toBe('slide')
      for (let i = 0; i < 40; i++) game.step()
      const yaw = slide.yaw
      const preview = slide.previewPath()
      expect(game.press()).toBe(true)
      expect(game.state.coinsLeft).toBe((stage.rules.coins ?? 0) - 1)
      // One duck at a time, and the slide holds still while it rides.
      expect(game.press()).toBe(false)
      expect(slide.busy).toBe(1)
      let steps = 0
      while (slide.rideOn && steps < 600) {
        game.step()
        expect(slide.yaw).toBe(yaw)
        steps++
      }
      expect(slide.rideOn).toBe(false)
      expect(slide.busy).toBe(0)
      const duck = game.engine.pucks.find(p => p.active && p.kind === 'player')!
      // It left the lip on the last step; the first steps out of it follow
      // the preview exactly.
      const exit = slideExit(yaw, config)
      for (let k = 1; k <= 4; k++) {
        const t = duck.body.translation()
        expect(t.x).toBeCloseTo(preview[k].x, 3)
        expect(t.y).toBeCloseTo(preview[k].y, 3)
        expect(t.z).toBeCloseTo(preview[k].z, 3)
        game.step()
      }
      expect(preview[0]).toEqual(exit.at)
      expect(slide.splash).not.toBeNull()
      game.dispose()
    })

    it('lands ducks somewhere different depending on when you press', () => {
      const lands = [0, 0.25, 0.5, 0.75].map(share => {
        const end = slideFlight(slideYaw(share * config.periodS, config), config).at(-1)!
        return Math.round(end.x * 10) / 10
      })
      expect(new Set(lands).size).toBeGreaterThan(2)
      // Every one lands inside the tub.
      for (const x of lands) expect(Math.abs(x)).toBeLessThan(3.6)
    })

    it('takes its time going down, about a second', () => {
      const { along } = slideCurve(config)
      const length = along[along.length - 1]
      const mean = (config.startSpeed + rideSpeed(config.pivot.y - config.lip.y, config)) / 2
      expect(length / mean / PHYSICS_STEP_S).toBeLessThan(90)
    })
  })
})
