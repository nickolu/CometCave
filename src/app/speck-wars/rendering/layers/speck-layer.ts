import { Container, Graphics, Sprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import type { SimulationState } from '../../domain/types'
import { SPECK_TYPES } from '../../domain/config/speck-types'

const ATTACK_ANIM_MS = 120

export class SpeckLayer {
  private containers: Map<string, Container> = new Map()
  private sprites: Map<string, Sprite[]> = new Map()
  private texture: Texture
  private playerColors: Record<string, number>
  private attackAnimByIndex: Map<number, number> = new Map()
  private gfx: Graphics
  readonly stage: Container

  constructor(texture: Texture, playerColors: Record<string, number>) {
    this.texture = texture
    this.playerColors = playerColors
    this.stage = new Container()

    for (const [playerId, color] of Object.entries(playerColors)) {
      const container = new Container()
      // tint exists on Container in Pixi 8 but is not visible in the TS type in
      // this Next.js project context — cast to apply it
      ;(container as Container & { tint: number }).tint = color
      this.stage.addChild(container)
      this.containers.set(playerId, container)
      this.sprites.set(playerId, [])
    }

    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
  }

  update(sim: SimulationState, selectedSpeckIds?: Set<string>) {
    this.gfx.clear()
    // Group live speck indices by owner
    const byOwner: Record<string, number[]> = {}
    for (let i = 0; i < sim.speckCount; i++) {
      if (!sim.speckIds[i]) continue
      const meta = sim.speckMeta[i]
      if (!meta) continue
      const ownerId = meta.ownerId
      if (!byOwner[ownerId]) byOwner[ownerId] = []
      byOwner[ownerId].push(i)
    }

    for (const [ownerId, container] of this.containers) {
      const indices = byOwner[ownerId] ?? []
      const spriteList = this.sprites.get(ownerId)!

      // Grow sprite pool if needed
      while (spriteList.length < indices.length) {
        const s = new Sprite(this.texture)
        s.anchor.set(0.5)
        container.addChild(s)
        spriteList.push(s)
      }

      // Update visible sprites
      const now = Date.now()
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]
        spriteList[j].position.set(sim.speckX[i], sim.speckY[i])
        spriteList[j].visible = true
        const typeMeta = sim.speckMeta[i]
        const stype = typeMeta ? SPECK_TYPES[typeMeta.typeId] : null
        // Track attack animation
        if (typeMeta?.state === 'attacking') this.attackAnimByIndex.set(i, now)
        const attackTs = this.attackAnimByIndex.get(i)
        let scaleBoost = 1.0
        if (attackTs !== undefined) {
          const elapsed = now - attackTs
          if (elapsed < ATTACK_ANIM_MS) {
            scaleBoost = 1 + 0.3 * (1 - elapsed / ATTACK_ANIM_MS)  // 1.3x → 1.0x
          } else {
            this.attackAnimByIndex.delete(i)
          }
        }
        spriteList[j].scale.set((stype ? stype.size / 4 : 0.75) * scaleBoost)
        // Fade speck as it takes damage — full HP = 1.0, near death = 0.35
        const hpFrac = stype ? Math.max(0, sim.speckHp[i] / stype.hp) : 1
        spriteList[j].alpha = 0.35 + 0.65 * hpFrac

        // Hero Commander: gold diamond + HP ring rendered before veteran/elite/legend rings
        if (typeMeta?.isHero) {
          const heroLevel = typeMeta.heroLevel ?? 0
          const size = 9 + heroLevel * 2
          const pulse = 0.8 + 0.2 * Math.sin(now * 0.003)
          this.gfx.beginFill(0xffd700, 0.6 * pulse)
          this.gfx.moveTo(sim.speckX[i], sim.speckY[i] - size)
          this.gfx.lineTo(sim.speckX[i] + size, sim.speckY[i])
          this.gfx.lineTo(sim.speckX[i], sim.speckY[i] + size)
          this.gfx.lineTo(sim.speckX[i] - size, sim.speckY[i])
          this.gfx.closePath()
          this.gfx.endFill()
          // Bright HP ring
          this.gfx.lineStyle(1.5, 0xffd700, 0.8 * pulse)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], size + 3)
          this.gfx.lineStyle(0)
        }

        // Gold ring for veteran specks (3+ kills), bright white+gold ring for elite (6+ kills), purple+white ring for legend (12+ kills)
        const kills = typeMeta?.kills ?? 0
        const isVeteran = kills >= 3
        const isElite = kills >= 6
        const isLegend = kills >= 12
        if (isLegend) {
          // Purple outer ring + pulsing white inner ring for legend
          const legendPulse = 0.6 + 0.4 * Math.sin(now / 160)  // faster pulse ~6Hz
          this.gfx.lineStyle(2.5, 0xcc44ff, legendPulse * spriteList[j].alpha)  // purple outer
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 7)
          this.gfx.lineStyle(2, 0xffffff, spriteList[j].alpha * 0.95)  // white inner
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 4)
          this.gfx.lineStyle(1.5, 0xcc44ff, spriteList[j].alpha * 0.6)  // faint purple core
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 1.5)
          this.gfx.lineStyle(0)
        } else if (isElite) {
          // Bright white outer ring + gold inner ring for elite
          const elitePulse = 0.7 + 0.3 * Math.sin(now / 200)
          this.gfx.lineStyle(2, 0xffffff, elitePulse * spriteList[j].alpha)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 5)
          this.gfx.lineStyle(1.5, 0xffd700, spriteList[j].alpha * 0.9)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 2.5)
          this.gfx.lineStyle(0)
        } else if (isVeteran) {
          this.gfx.lineStyle(1.5, 0xffd700, spriteList[j].alpha * 0.9)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 2.5)
          this.gfx.lineStyle(0)
        }

        // Commander: large animated golden ring
        if (typeMeta?.isCommander) {
          const level = typeMeta?.commanderLevel ?? 0
          const cmdPulse = 0.65 + 0.35 * Math.sin(now / 300)
          const cmdColor = level >= 3 ? 0x00ffcc : level >= 2 ? 0xffd700 : 0xccaa00
          this.gfx.lineStyle(2, cmdColor, cmdPulse * spriteList[j].alpha)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 10)
          if (level >= 2) {
            this.gfx.lineStyle(1.5, 0xffffff, 0.5 * spriteList[j].alpha)
            this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], (stype ? stype.size / 4 : 0.75) + 13)
          }
          this.gfx.lineStyle(0)
        }

        const isHeavy = typeMeta?.typeId === 'heavy'
        if (isHeavy) {
          this.gfx.lineStyle(1, 0xffffff, spriteList[j].alpha * 0.6)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], 2)
          this.gfx.lineStyle(0)
          // Critical HP ring: red outline when heavy speck is at 40% HP or below
          if (stype && hpFrac <= 0.4 && hpFrac > 0) {
            const critIntensity = (0.4 - hpFrac) / 0.4   // 0.0 → 1.0 as HP drops
            const critAlpha = critIntensity * 0.8 * spriteList[j].alpha
            const critPulse = 0.5 + 0.5 * Math.sin(now / 120)  // fast pulse ~8Hz
            this.gfx.lineStyle(1.2, 0xff2222, critAlpha * critPulse)
            this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], stype.size / 4 + 2)
            this.gfx.lineStyle(0)
          }
        }

        // Motion trail: 3 fading dots extrapolated backwards from velocity
        const vx = sim.speckVx[i], vy = sim.speckVy[i]
        if (vx * vx + vy * vy > 900) {  // only when moving faster than ~30 px/s
          const color = this.playerColors[ownerId] ?? 0xffffff
          const baseAlpha = spriteList[j].alpha
          const trailAlphas = [0.18, 0.09, 0.04] as const
          for (let t = 1; t <= 3; t++) {
            this.gfx.beginFill(color, baseAlpha * trailAlphas[t - 1])
            this.gfx.drawCircle(
              sim.speckX[i] - vx * (t * 0.018),
              sim.speckY[i] - vy * (t * 0.018),
              1.2,
            )
            this.gfx.endFill()
          }
        }

        // Selection indicator: pulsing filled glow + solid ring (must be large enough to see at low zoom)
        const speckId = sim.speckMeta[i]?.id ?? ''
        if (selectedSpeckIds?.has(speckId)) {
          const selPulse = 0.22 + 0.13 * Math.sin(now / 280)
          const selRadius = (stype ? stype.size / 4 : 0.75) + 8
          this.gfx.beginFill(0xffe066, selPulse)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], selRadius)
          this.gfx.endFill()
          this.gfx.lineStyle(2, 0xffe066, 0.9)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], selRadius)
          this.gfx.lineStyle(0)
        }
      }

      // Hide excess sprites
      for (let j = indices.length; j < spriteList.length; j++) {
        spriteList[j].visible = false
      }
    }
  }

  destroy() {
    this.stage.destroy({ children: true })
  }
}
