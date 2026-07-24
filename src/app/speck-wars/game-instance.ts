export class GameInstance {
  private canvas: HTMLCanvasElement
  private rafId: number | null = null
  private tickCount = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  start() {
    console.log('GameInstance started')
    const loop = () => {
      this.tickCount++
      if (this.tickCount % 60 === 0) {
        console.log(`GameInstance tick: ${this.tickCount}`)
      }
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    console.log('GameInstance destroyed')
  }
}
