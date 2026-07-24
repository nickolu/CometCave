import { Graphics, Container } from 'pixi.js'

interface Flash { x: number; y: number; life: number; maxLife: number; color: number }
interface Ping { x: number; y: number; life: number; maxLife: number }

export class EffectsLayer {
  readonly stage: Container
  private gfx: Graphics
  private flashes: Flash[] = []
  private pings: Ping[] = []

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  addDeathFlash(x: number, y: number, color = 0xffffff) {
    this.flashes.push({ x, y, life: 300, maxLife: 300, color })
  }

  showRallyPing(x: number, y: number) {
    this.pings.push({ x, y, life: 400, maxLife: 400 })
  }

  update(dt: number) {
    this.gfx.clear()

    this.pings = this.pings.filter(p => p.life > 0)
    for (const p of this.pings) {
      p.life -= dt
      const alpha = p.life / p.maxLife
      const r = (1 - alpha) * 24 + 4   // expands from 4 to 28
      this.gfx.lineStyle(2, 0x4af7c4, alpha * 0.8)
      this.gfx.drawCircle(p.x, p.y, r)
      this.gfx.lineStyle(0)  // reset
    }

    this.flashes = this.flashes.filter(f => f.life > 0)
    for (const f of this.flashes) {
      f.life -= dt
      const alpha = f.life / f.maxLife
      const r = 3 + (1 - alpha) * 4
      this.gfx.beginFill(f.color, alpha)
      this.gfx.drawCircle(f.x, f.y, r)
      this.gfx.endFill()
    }
  }

  destroy() { this.stage.destroy({ children: true }) }
}
