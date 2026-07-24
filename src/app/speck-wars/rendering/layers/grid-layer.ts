import { Graphics, Container } from 'pixi.js'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../domain/constants'

const GRID_SIZE = 200   // px between grid lines

export class GridLayer {
  readonly stage: Container
  private gfx: Graphics

  constructor() {
    this.stage = new Container()
    this.gfx = new Graphics()
    this.stage.addChild(this.gfx)
    this.draw()
  }

  private draw() {
    this.gfx.clear()

    // Vertical grid lines
    this.gfx.lineStyle(1, 0xffffff, 0.05)
    for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
      this.gfx.moveTo(x, 0)
      this.gfx.lineTo(x, WORLD_HEIGHT)
    }

    // Horizontal grid lines
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
      this.gfx.moveTo(0, y)
      this.gfx.lineTo(WORLD_WIDTH, y)
    }

    // World border
    this.gfx.lineStyle(2, 0xffffff, 0.2)
    this.gfx.drawRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.gfx.lineStyle(0)
  }

  destroy() { this.stage.destroy({ children: true }) }
}
