import type { Camera } from '../rendering/camera'
import { zoomAt, screenToWorld } from '../rendering/camera'

export class InputHandler {
  private canvas: HTMLCanvasElement
  private camera: Camera
  private onRally?: (worldX: number, worldY: number) => void
  private onTogglePause?: () => void
  private onClearRally?: () => void
  private isDragging = false
  private lastX = 0
  private lastY = 0
  private mouseDownX = 0
  private mouseDownY = 0

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    onRally?: (worldX: number, worldY: number) => void,
    onTogglePause?: () => void,
    onClearRally?: () => void,
  ) {
    this.canvas = canvas
    this.camera = camera
    this.onRally = onRally
    this.onTogglePause = onTogglePause
    this.onClearRally = onClearRally
    this.attach()
  }

  private attach() {
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    // Touch support
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })
    window.addEventListener('touchend', this.onTouchEnd)
    window.addEventListener('keydown', this.onKeyDown)
  }

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.mouseDownX = e.clientX
    this.mouseDownY = e.clientY
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return
    this.camera.x += e.clientX - this.lastX
    this.camera.y += e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
  }

  private onMouseUp = (e: MouseEvent) => {
    const dx = e.clientX - this.mouseDownX
    const dy = e.clientY - this.mouseDownY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 5 && this.onRally) {
      const rect = this.canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const world = screenToWorld(sx, sy, this.camera)
      this.onRally(world.x, world.y)
    }

    this.isDragging = false
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const rect = this.canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    Object.assign(this.camera, zoomAt(this.camera, sx, sy, factor))
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.isDragging = true
      this.lastX = e.touches[0].clientX
      this.lastY = e.touches[0].clientY
    }
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isDragging || e.touches.length !== 1) return
    e.preventDefault()
    this.camera.x += e.touches[0].clientX - this.lastX
    this.camera.y += e.touches[0].clientY - this.lastY
    this.lastX = e.touches[0].clientX
    this.lastY = e.touches[0].clientY
  }

  private onTouchEnd = () => { this.isDragging = false }

  private onKeyDown = (e: KeyboardEvent) => {
    // Don't fire when typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.code === 'Space') {
      e.preventDefault()
      this.onTogglePause?.()
    } else if (e.code === 'KeyR') {
      this.onClearRally?.()
    }
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    window.removeEventListener('touchend', this.onTouchEnd)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}
