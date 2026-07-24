import { Application, Graphics } from 'pixi.js'
import type { RenderTexture } from 'pixi.js'

export function createSpeckTexture(app: Application, radius: number = 4): RenderTexture {
  const g = new Graphics()
  // Use Pixi 8 compatible API (beginFill/drawCircle are still available as deprecated wrappers)
  g.beginFill(0xffffff)
  g.drawCircle(0, 0, radius)
  g.endFill()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (app.renderer as any).generateTexture(g) as RenderTexture
}
