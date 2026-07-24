import type { Camera } from '../rendering/camera'
import { zoomAt, screenToWorld } from '../rendering/camera'

export class InputHandler {
  private canvas: HTMLCanvasElement
  private camera: Camera
  private onRally?: (worldX: number, worldY: number) => void
  private onTogglePause?: () => void
  private onClearRally?: () => void
  private onCycleSpawnMode?: () => void
  private onRecenterCamera?: () => void
  private onDefend?: () => void
  private onAdvance?: () => void
  private onRush?: () => void
  private onBoxSelect?: (x1: number, y1: number, x2: number, y2: number) => void
  private onClearSelect?: () => void
  private onSurge?: () => void
  private onSnapToAction?: () => void
  private onSnapToBase?: () => void
  private onSetSpawnType?: (typeId: 'basic' | 'heavy' | 'scout') => void
  private onCycleSpeed?: () => void
  private onSelectAll?: () => void
  private onSacrifice?: () => void
  private isDragging = false
  private lastX = 0
  private lastY = 0
  private mouseDownX = 0
  private mouseDownY = 0
  private mouseX = -1  // -1 means mouse not over canvas
  private mouseY = -1
  private lastPinchDist = 0  // 0 = not pinching
  private touchStartX = 0
  private touchStartY = 0
  private isShiftDrag = false
  private shiftDragStartWorldX = 0
  private shiftDragStartWorldY = 0

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    onRally?: (worldX: number, worldY: number) => void,
    onTogglePause?: () => void,
    onClearRally?: () => void,
    onCycleSpawnMode?: () => void,
    onRecenterCamera?: () => void,
    onDefend?: () => void,
    onAdvance?: () => void,
    onRush?: () => void,
    onBoxSelect?: (x1: number, y1: number, x2: number, y2: number) => void,
    onClearSelect?: () => void,
    onSurge?: () => void,
    onSnapToAction?: () => void,
    onSnapToBase?: () => void,
    onSetSpawnType?: (typeId: 'basic' | 'heavy' | 'scout') => void,
    onCycleSpeed?: () => void,
    onSelectAll?: () => void,
    onSacrifice?: () => void,
  ) {
    this.canvas = canvas
    this.camera = camera
    this.onRally = onRally
    this.onTogglePause = onTogglePause
    this.onClearRally = onClearRally
    this.onCycleSpawnMode = onCycleSpawnMode
    this.onRecenterCamera = onRecenterCamera
    this.onDefend = onDefend
    this.onAdvance = onAdvance
    this.onRush = onRush
    this.onBoxSelect = onBoxSelect
    this.onClearSelect = onClearSelect
    this.onSurge = onSurge
    this.onSnapToAction = onSnapToAction
    this.onSnapToBase = onSnapToBase
    this.onSetSpawnType = onSetSpawnType
    this.onCycleSpeed = onCycleSpeed
    this.onSelectAll = onSelectAll
    this.onSacrifice = onSacrifice
    this.attach()
  }

  private attach() {
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
    // Touch support
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })
    window.addEventListener('touchend', this.onTouchEnd)
    window.addEventListener('keydown', this.onKeyDown)
    this.canvas.addEventListener('mousemove', this.onCanvasMouseMove)
    this.canvas.addEventListener('mouseleave', this.onMouseLeave)
  }

  private onCanvasMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = e.clientX - rect.left
    this.mouseY = e.clientY - rect.top
  }

  private onMouseLeave = () => { this.mouseX = -1; this.mouseY = -1 }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault()   // suppress browser context menu
    this.onClearRally?.()
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()  // prevent middle-click scroll
    if (e.button === 0 && e.shiftKey) {
      this.isShiftDrag = true
      const rect = this.canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const world = screenToWorld(sx, sy, this.camera)
      this.shiftDragStartWorldX = world.x
      this.shiftDragStartWorldY = world.y
      this.mouseDownX = e.clientX
      this.mouseDownY = e.clientY
      return  // don't start pan
    }
    this.isDragging = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.mouseDownX = e.clientX
    this.mouseDownY = e.clientY
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return
    // Update cursor position always (needed for selection box visual)
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = e.clientX - rect.left
    this.mouseY = e.clientY - rect.top
    if (this.isShiftDrag) return  // skip pan during shift-drag
    this.camera.x += e.clientX - this.lastX
    this.camera.y += e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
  }

  private onMouseUp = (e: MouseEvent) => {
    const dx = e.clientX - this.mouseDownX
    const dy = e.clientY - this.mouseDownY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (this.isShiftDrag) {
      this.isShiftDrag = false
      if (dist > 10) {
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const world = screenToWorld(sx, sy, this.camera)
        this.onBoxSelect?.(this.shiftDragStartWorldX, this.shiftDragStartWorldY, world.x, world.y)
      } else {
        // Tiny shift-click: clear selection
        this.onClearSelect?.()
      }
      return
    }

    // Middle-click: clear rally
    if (e.button === 1 && dist < 5) {
      this.onClearRally?.()
      this.isDragging = false
      return
    }

    if (e.button === 0 && dist < 5 && this.onRally) {
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
      this.lastPinchDist = 0
      this.lastX = e.touches[0].clientX
      this.lastY = e.touches[0].clientY
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      this.isDragging = false
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      this.lastPinchDist = Math.sqrt(dx * dx + dy * dy)
    }
  }

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && this.lastPinchDist > 0) {
      // Pinch-to-zoom: compute new distance and zoom toward pinch midpoint
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const newDist = Math.sqrt(dx * dx + dy * dy)
      const factor = newDist / this.lastPinchDist
      const rect = this.canvas.getBoundingClientRect()
      const mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left
      const my = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top
      Object.assign(this.camera, zoomAt(this.camera, mx, my, factor))
      this.lastPinchDist = newDist
    } else if (this.isDragging && e.touches.length === 1) {
      this.camera.x += e.touches[0].clientX - this.lastX
      this.camera.y += e.touches[0].clientY - this.lastY
      this.lastX = e.touches[0].clientX
      this.lastY = e.touches[0].clientY
    }
  }

  private onTouchEnd = (e: TouchEvent) => {
    // Tap-to-rally: single finger tap (small movement) → set rally at tap position
    if (this.lastPinchDist === 0 && e.changedTouches.length === 1 && this.onRally) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - this.touchStartX
      const dy = touch.clientY - this.touchStartY
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        const rect = this.canvas.getBoundingClientRect()
        const sx = touch.clientX - rect.left
        const sy = touch.clientY - rect.top
        if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
          const world = screenToWorld(sx, sy, this.camera)
          this.onRally(world.x, world.y)
        }
      }
    }
    this.isDragging = false
    this.lastPinchDist = 0
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Don't fire when typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.code === 'Space') {
      e.preventDefault()
      this.onTogglePause?.()
    } else if (e.code === 'Escape') {
      this.onClearSelect?.()
    } else if (e.code === 'KeyR') {
      this.onClearRally?.()
    } else if (e.code === 'KeyH') {
      this.onSnapToBase?.()
    } else if (e.code === 'KeyC') {
      this.onRecenterCamera?.()
    } else if (e.code === 'KeyD') {
      this.onDefend?.()
    } else if (e.code === 'KeyA') {
      this.onAdvance?.()
    } else if (e.code === 'KeyB') {
      this.onRush?.()
    } else if (e.code === 'KeyQ') {
      this.onSurge?.()
    } else if (e.code === 'KeyV') {
      this.onSnapToAction?.()
    } else if (e.code === 'Digit1') {
      this.onSetSpawnType?.('basic')
    } else if (e.code === 'Digit2') {
      this.onSetSpawnType?.('heavy')
    } else if (e.code === 'Digit3') {
      this.onSetSpawnType?.('scout')
    } else if (e.code === 'KeyX') {
      this.onCycleSpeed?.()
    } else if (e.code === 'KeyE') {
      this.onSelectAll?.()
    } else if (e.code === 'KeyF') {
      this.onSacrifice?.()
    }
  }

  getDragRect(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.isShiftDrag) return null
    const rect = this.canvas.getBoundingClientRect()
    return {
      x1: this.mouseDownX - rect.left,
      y1: this.mouseDownY - rect.top,
      x2: this.mouseX,
      y2: this.mouseY,
    }
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    window.removeEventListener('touchend', this.onTouchEnd)
    window.removeEventListener('keydown', this.onKeyDown)
    this.canvas.removeEventListener('mousemove', this.onCanvasMouseMove)
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave)
  }

  getEdgePanDelta(dt: number, paused: boolean): { dx: number; dy: number } {
    if (paused || this.mouseX < 0) return { dx: 0, dy: 0 }
    const EDGE_ZONE = 40
    const MAX_SPEED = 400  // px/sec in world space (before zoom)
    const dtSec = dt / 1000
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight

    let dx = 0, dy = 0

    if (this.mouseX < EDGE_ZONE) {
      dx = -(1 - this.mouseX / EDGE_ZONE) * MAX_SPEED * dtSec
    } else if (this.mouseX > w - EDGE_ZONE) {
      dx = (1 - (w - this.mouseX) / EDGE_ZONE) * MAX_SPEED * dtSec
    }
    if (this.mouseY < EDGE_ZONE) {
      dy = -(1 - this.mouseY / EDGE_ZONE) * MAX_SPEED * dtSec
    } else if (this.mouseY > h - EDGE_ZONE) {
      dy = (1 - (h - this.mouseY) / EDGE_ZONE) * MAX_SPEED * dtSec
    }

    return { dx, dy }
  }
}
