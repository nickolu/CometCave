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

  update(sim: SimulationState) {
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

        const isHeavy = typeMeta?.typeId === 'heavy'
        if (isHeavy) {
          this.gfx.lineStyle(1, 0xffffff, spriteList[j].alpha * 0.6)
          this.gfx.drawCircle(sim.speckX[i], sim.speckY[i], 2)
          this.gfx.lineStyle(0)
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
