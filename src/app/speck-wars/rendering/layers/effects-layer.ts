import { Graphics, Container } from 'pixi.js'

interface Flash { x: number; y: number; life: number; maxLife: number }

export class EffectsLayer {
  readonly stage: Container
  private gfx: Graphics
  private flashes: Flash[] = []

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  addDeathFlash(x: number, y: number) {
    this.flashes.push({ x, y, life: 300, maxLife: 300 })
  }

  update(dt: number) {
    this.gfx.clear()
    this.flashes = this.flashes.filter(f => f.life > 0)
    for (const f of this.flashes) {
      f.life -= dt
      const alpha = f.life / f.maxLife
      const r = 3 + (1 - alpha) * 4
      this.gfx.beginFill(0xffffff, alpha)
      this.gfx.drawCircle(f.x, f.y, r)
      this.gfx.endFill()
    }
  }

  destroy() { this.stage.destroy({ children: true }) }
}
