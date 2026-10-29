import { initPhysics } from './engine'
import { DropGame } from './game'
import { moonAt, moonPull } from './moon'
import { type StageDef, playableStage } from './stages'

const GRAVITY_ASSIST = playableStage('gravity-assist') as StageDef
const MOON = GRAVITY_ASSIST.moon!

describe('the moon', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('circles its orbit once a period', () => {
    const start = moonAt(0, MOON)
    const later = moonAt(MOON.periodS, MOON)
    expect(later.x).toBeCloseTo(start.x)
    expect(later.z).toBeCloseTo(start.z)
    expect(moonAt(MOON.periodS / 4, MOON).x).toBeCloseTo(MOON.center.x + MOON.radiusX)
  })

  it('pulls toward itself, weaker further off, and leaves the pile alone', () => {
    const moon = { x: 2, y: 5, z: 0 }
    const a = moonPull({ x: 0, y: 5, z: -4 }, moon, MOON)
    expect(a.x).toBeGreaterThan(0)
    // Gravity Assist's plunger flies front to back, so its moon pulls that way too.
    expect(a.z).toBeGreaterThan(0)
    const far = moonPull({ x: -3, y: 5, z: -4 }, moon, MOON)
    expect(Math.abs(far.x)).toBeLessThan(a.x)
    expect(moonPull({ x: 0, y: MOON.minY - 0.01, z: -4 }, moon, MOON)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('pulls across and up or down only, unless the stage asks for front to back', () => {
    const flat = { ...MOON, pullZ: false }
    const a = moonPull({ x: 0, y: 5, z: -4 }, { x: 2, y: 5, z: 0 }, flat)
    expect(a.x).toBeGreaterThan(0)
    expect(a.z).toBe(0)
  })

  it('previews exactly the curve a dropped coin falls', () => {
    // Under an arm hung high, as Gravity Assist had before its plunger: the
    // same prediction now places its meteorites.
    const underArm: StageDef = {
      ...GRAVITY_ASSIST,
      delivery: undefined,
      arm: { ...GRAVITY_ASSIST.arm, pivotY: 14.5 },
    }
    const game = new DropGame(underArm, { pile: [] })
    for (const wait of [0, 37, 90]) {
      for (let i = 0; i < wait; i++) game.step()
      const path = game.dropPath()
      const before = new Set(game.engine.pucks.flatMap((p, i) => (p.active ? [i] : [])))
      expect(game.tapDrop()).toBe(true)
      const index = game.engine.pucks.findIndex((p, i) => p.active && !before.has(i))
      let bend = 0
      for (let i = 1; i < path.length && path[i].y > 1.6; i++) {
        game.step()
        const t = game.engine.pucks[index].body.translation()
        expect(Math.hypot(t.x - path[i].x, t.y - path[i].y, t.z - path[i].z)).toBeLessThan(1e-3)
        bend = Math.max(bend, Math.abs(t.x - path[0].x))
      }
      // It visibly bends.
      expect(bend).toBeGreaterThan(0.1)
      for (let i = 0; i < 120; i++) game.step()
    }
    game.dispose()
  })

  it('announces each meteorite after its drop, then drops it where the countdown said', () => {
    const game = new DropGame(GRAVITY_ASSIST, { pile: [] })
    const first = GRAVITY_ASSIST.meteors!.schedule[0]
    const warn = GRAVITY_ASSIST.meteors!.warnS
    let announced = 0
    for (let n = 0; n < first.afterDrop; n++) {
      expect(game.meteorWarnings()).toHaveLength(0)
      game.tapDrop()
      for (let i = 0; i < 6; i++) announced += game.step().filter(e => e.type === 'meteor').length
    }
    expect(announced).toBe(1)
    const [warning] = game.meteorWarnings()
    expect(warning.secondsLeft).toBeGreaterThan(warn - 0.2)
    const meteor = game.engine.pucks.find(p => p.spec.id === 'meteorite')!
    while (!meteor.active) game.step()
    // It falls to the spot the countdown was on.
    let lowest = meteor.body.translation()
    for (let i = 0; i < 120 && lowest.y > 1; i++) {
      game.step()
      lowest = meteor.body.translation()
    }
    expect(Math.hypot(lowest.x - warning.x, lowest.z - warning.z)).toBeLessThan(0.15)
    game.dispose()
  })
})
