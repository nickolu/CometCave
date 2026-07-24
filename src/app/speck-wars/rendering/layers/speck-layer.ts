import { Container, Sprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import type { SimulationState } from '../../domain/types'

export class SpeckLayer {
  private containers: Map<string, Container> = new Map()
  private sprites: Map<string, Sprite[]> = new Map()
  private texture: Texture
  private playerColors: Record<string, number>
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
  }

  update(sim: SimulationState) {
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
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]
        spriteList[j].position.set(sim.speckX[i], sim.speckY[i])
        spriteList[j].visible = true
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
