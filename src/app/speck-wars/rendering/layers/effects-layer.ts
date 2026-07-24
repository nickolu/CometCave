import { Graphics, Container } from 'pixi.js'

interface Flash { x: number; y: number; life: number; maxLife: number; color: number }
interface Ping { x: number; y: number; life: number; maxLife: number }
interface Ripple { x: number; y: number; life: number; maxLife: number; color: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number }
interface CombatZone { x: number; y: number; life: number; maxLife: number }

const COMBAT_ZONE_LIFE = 3000   // ms a zone persists with no new kills
const COMBAT_ZONE_MERGE_DIST = 60  // px — nearby kills refresh existing zone

export class EffectsLayer {
  readonly stage: Container
  private gfx: Graphics
  private flashes: Flash[] = []
  private pings: Ping[] = []
  private ripples: Ripple[] = []
  private particles: Particle[] = []
  private combatZones: CombatZone[] = []

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  addDeathFlash(x: number, y: number, color = 0xffffff) {
    this.flashes.push({ x, y, life: 300, maxLife: 300, color })
  }

  showRallyPing(x: number, y: number) {
    // Two rings: fast inner + slower outer
    this.pings.push({ x, y, life: 320, maxLife: 320 })
    this.pings.push({ x, y, life: 540, maxLife: 540 })
    // 4 brief crosshair sparks
    const S = 12
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]] as const
    for (const [dx, dy] of dirs) {
      this.particles.push({ x, y, vx: dx * S * 50, vy: dy * S * 50, life: 180, maxLife: 180, color: 0x4af7c4 })
    }
  }

  addDeathParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const speed = 50 + Math.random() * 60  // px/sec
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 280, maxLife: 280, color })
    }
  }

  addCaptureRipple(x: number, y: number, color: number) {
    // Three concentric expanding rings for dramatic capture effect
    for (let i = 0; i < 3; i++) {
      this.ripples.push({ x, y, life: 800 - i * 200, maxLife: 800 - i * 200, color })
    }
  }

  markCombatAt(x: number, y: number) {
    // Refresh or create a combat zone near this position
    const md2 = COMBAT_ZONE_MERGE_DIST * COMBAT_ZONE_MERGE_DIST
    for (const z of this.combatZones) {
      if ((z.x - x) ** 2 + (z.y - y) ** 2 < md2) {
        z.life = COMBAT_ZONE_LIFE  // refresh
        return
      }
    }
    this.combatZones.push({ x, y, life: COMBAT_ZONE_LIFE, maxLife: COMBAT_ZONE_LIFE })
  }

  addDestructionBurst(x: number, y: number, color: number) {
    // 20 radial particles — fast, long-lived, large burst for building destruction
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const speed = 80 + Math.random() * 120  // px/sec
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 600, maxLife: 600, color })
    }
    // Large shockwave rings
    for (let i = 0; i < 3; i++) {
      this.ripples.push({ x, y, life: 500 - i * 100, maxLife: 500 - i * 100, color: 0xffffff })
    }
  }

  update(dt: number) {
    this.gfx.clear()

    this.pings = this.pings.filter(p => p.life > 0)
    for (const p of this.pings) {
      p.life -= dt
      const alpha = p.life / p.maxLife
      // Shorter-lived pings expand less; longer-lived ones expand further
      const maxR = p.maxLife > 400 ? 44 : 26
      const r = (1 - alpha) * maxR + 4
      const thickness = p.maxLife > 400 ? 1.2 : 2
      this.gfx.lineStyle(thickness, 0x4af7c4, alpha * 0.8)
      this.gfx.drawCircle(p.x, p.y, r)
      this.gfx.lineStyle(0)
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

    this.particles = this.particles.filter(p => p.life > 0)
    for (const p of this.particles) {
      p.x += p.vx * (dt / 1000)
      p.y += p.vy * (dt / 1000)
      p.life -= dt
      const alpha = (p.life / p.maxLife) * 0.85
      this.gfx.beginFill(p.color, alpha)
      this.gfx.drawCircle(p.x, p.y, 1.5)
      this.gfx.endFill()
    }

    this.ripples = this.ripples.filter(r => r.life > 0)
    for (const r of this.ripples) {
      r.life -= dt
      const t = 1 - r.life / r.maxLife
      const radius = 24 + t * 60  // expands from 24 to 84px
      const alpha = (1 - t) * 0.6
      this.gfx.lineStyle(2, r.color, alpha)
      this.gfx.drawCircle(r.x, r.y, radius)
      this.gfx.lineStyle(0)
    }

    // Combat zone hazes — faint pulsing orange rings where battles are happening
    this.combatZones = this.combatZones.filter(z => z.life > 0)
    const now = Date.now()
    for (const z of this.combatZones) {
      z.life -= dt
      const ageFrac = z.life / z.maxLife          // 1.0 (fresh) → 0.0 (expired)
      const pulse = 0.5 + 0.5 * Math.sin(now / 350)  // ~2.8Hz pulse
      const alpha = ageFrac * 0.12 * pulse
      if (alpha > 0.005) {
        this.gfx.lineStyle(1.5, 0xff6620, alpha)
        this.gfx.drawCircle(z.x, z.y, 28)
        this.gfx.lineStyle(0)
        this.gfx.beginFill(0xff4400, ageFrac * 0.03 * pulse)
        this.gfx.drawCircle(z.x, z.y, 22)
        this.gfx.endFill()
      }
    }
  }

  destroy() { this.stage.destroy({ children: true }) }
}
