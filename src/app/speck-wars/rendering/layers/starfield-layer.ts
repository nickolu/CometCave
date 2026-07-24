import { Graphics, Container } from 'pixi.js'

// Simple deterministic pseudo-random (xorshift32) — fixed seed so stars are stable
function xr(s: number) { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000 }

export class StarfieldLayer {
  readonly stage: Container

  constructor() {
    this.stage = new Container()
    const gfx = new Graphics()

    // Spread stars over an area larger than the 3000×3000 world
    const AREA_X = -800, AREA_Y = -800, AREA_W = 4600, AREA_H = 4600
    const STAR_COUNT = 420

    let seed = 0xdeadbeef
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }

    for (let i = 0; i < STAR_COUNT; i++) {
      const x = AREA_X + rng() * AREA_W
      const y = AREA_Y + rng() * AREA_H
      const t = rng()          // type selector
      const r = t < 0.75 ? 0.6 + rng() * 0.5     // small  (75%)
              : t < 0.95 ? 1.2 + rng() * 0.8     // medium (20%)
              :             2.0 + rng() * 1.2     // large  (5%)
      const alpha = 0.08 + rng() * 0.36

      // Subtle color variety: ~20% slightly blue-purple, rest white
      const colorRoll = rng()
      const color = colorRoll < 0.12 ? 0xaab8ff    // blue-white
                  : colorRoll < 0.20 ? 0xddccff    // soft violet
                  : 0xffffff                        // white

      gfx.beginFill(color, alpha)
      gfx.drawCircle(x, y, r)
      gfx.endFill()
    }

    this.stage.addChild(gfx)
  }

  destroy() { this.stage.destroy({ children: true }) }
}
