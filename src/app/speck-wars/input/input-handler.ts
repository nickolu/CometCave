import type { Camera } from '../rendering/camera'
import { zoomAt, screenToWorld } from '../rendering/camera'
import { emitLongPressStart, emitLongPressCancel, emitTapRipple } from './touch-feedback'

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
  private onAdvanceOutpost?: () => void
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
  private onSaveControlGroup?: (slot: number) => void
  private onRecallControlGroup?: (slot: number) => void
  private pendingModifier: 'none' | 'attack' | 'patrol' = 'none'
  private isPanDragging = false   // middle-mouse only
  private isRightDragging = false
  private pendingBuildActive = false
  private onStop?: () => void
  private onHold?: () => void
  private onAttackMove?: (worldX: number, worldY: number) => void
  private onPatrol?: (worldX: number, worldY: number) => void
  public onBuildTurret?: () => void
  public onGuard?: () => void
  public onCycleStance?: () => void
  public onCommanderAbility?: () => void
  private heldKeys = new Set<string>()
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
  private isDragSelect = false
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  private longPressFired = false
  private dragSelectStartWorldX = 0
  private dragSelectStartWorldY = 0
  private lastTapTime = 0
  private lastTapX = 0
  private lastTapY = 0
  private touchPatrolPending = false
  private touchSelectMode = false
  private twoFingerActive = false      // true while 2 fingers are on canvas
  private twoFingerMoved = false       // true if pinch changed significantly (not a tap)
  private twoFingerTapStartDist = 0   // initial pinch distance when 2nd finger touched

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
    onAdvanceOutpost?: () => void,
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
    onSaveControlGroup?: (slot: number) => void,
    onRecallControlGroup?: (slot: number) => void,
    onStop?: () => void,
    onHold?: () => void,
    onAttackMove?: (worldX: number, worldY: number) => void,
    onPatrol?: (worldX: number, worldY: number) => void,
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
    this.onAdvanceOutpost = onAdvanceOutpost
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
    this.onSaveControlGroup = onSaveControlGroup
    this.onRecallControlGroup = onRecallControlGroup
    this.onStop = onStop
    this.onHold = onHold
    this.onAttackMove = onAttackMove
    this.onPatrol = onPatrol
    this.attach()
  }

  private attach() {
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
    // Touch support
    // passive: false required to allow preventDefault() in onTouchStart (blocks browser context menu)
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    window.addEventListener('touchmove', this.onTouchMove, { passive: false })
    window.addEventListener('touchend', this.onTouchEnd)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', () => this.heldKeys.clear())
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
    e.preventDefault()
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      this.isPanDragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
      return
    }
    if (e.button === 0) {
      this.isDragSelect = true
      const rect = this.canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const world = screenToWorld(sx, sy, this.camera)
      this.dragSelectStartWorldX = world.x
      this.dragSelectStartWorldY = world.y
      this.mouseDownX = e.clientX
      this.mouseDownY = e.clientY
      this.isDragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
    }
    if (e.button === 2) {
      // track for right-click drag detection
      this.mouseDownX = e.clientX
      this.mouseDownY = e.clientY
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.isRightDragging = true
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = e.clientX - rect.left
    this.mouseY = e.clientY - rect.top
    if (this.isPanDragging) {
      this.camera.x += e.clientX - this.lastX
      this.camera.y += e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
    }
    if (this.isRightDragging) {
      this.camera.x += e.clientX - this.lastX
      this.camera.y += e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
    }
    // drag-select visual update via isDragSelect (no action needed — renderer reads getDragRect)
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 1) {
      this.isPanDragging = false
      return
    }

    const dx = e.clientX - this.mouseDownX
    const dy = e.clientY - this.mouseDownY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (e.button === 0 && this.isDragSelect) {
      this.isDragSelect = false
      this.isDragging = false
      if (dist > 10) {
        // Box-select
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const world = screenToWorld(sx, sy, this.camera)
        this.onBoxSelect?.(this.dragSelectStartWorldX, this.dragSelectStartWorldY, world.x, world.y)
      } else {
        if (this.pendingBuildActive) {
          // In build placement mode: left-click places the building
          const rect = this.canvas.getBoundingClientRect()
          const sx = e.clientX - rect.left
          const sy = e.clientY - rect.top
          const world = screenToWorld(sx, sy, this.camera)
          this.onRally?.(world.x, world.y)
        } else {
          // Normal left-click: deselect all
          this.onClearSelect?.()
        }
      }
      return
    }

    if (e.button === 2) {
      this.isRightDragging = false
    }
    if (e.button === 2 && dist < 5) {
      // Right-click: issue move, attack-move, or patrol command
      const rect = this.canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const world = screenToWorld(sx, sy, this.camera)
      if (this.pendingModifier === 'attack') {
        this.onAttackMove?.(world.x, world.y)
        this.pendingModifier = 'none'
        if (this.canvas) this.canvas.style.cursor = 'default'
      } else if (this.pendingModifier === 'patrol') {
        this.onPatrol?.(world.x, world.y)
        this.pendingModifier = 'none'
        if (this.canvas) this.canvas.style.cursor = 'default'
      } else {
        this.onRally?.(world.x, world.y)
      }
      return
    }

    this.isDragging = false
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey) {
      // Pinch-to-zoom (trackpad) or Ctrl+scroll — zoom toward cursor
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const rect = this.canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      Object.assign(this.camera, zoomAt(this.camera, sx, sy, factor))
    } else {
      // Two-finger swipe (trackpad) or scroll wheel — pan camera
      this.camera.x -= e.deltaX
      this.camera.y -= e.deltaY
    }
  }

  private onTouchStart = (e: TouchEvent) => {
    // Prevent browser context menu and text selection on long-press (requires passive:false)
    e.preventDefault()
    if (e.touches.length === 1) {
      if (this.touchSelectMode) {
        clearTimeout(this.longPressTimer!)
        this.longPressTimer = null
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.touches[0].clientX - rect.left
        const sy = e.touches[0].clientY - rect.top
        const world = screenToWorld(sx, sy, this.camera)
        this.mouseDownX = e.touches[0].clientX
        this.mouseDownY = e.touches[0].clientY
        this.mouseX = sx
        this.mouseY = sy
        this.isDragSelect = true
        this.dragSelectStartWorldX = world.x
        this.dragSelectStartWorldY = world.y
        this.touchStartX = e.touches[0].clientX
        this.touchStartY = e.touches[0].clientY
        return
      }
      this.isDragging = true
      this.lastPinchDist = 0
      this.lastX = e.touches[0].clientX
      this.lastY = e.touches[0].clientY
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
      this.longPressFired = false
      // Long-press: if finger stays >500ms without moving, fire attack-move
      this.longPressTimer = setTimeout(() => {
        const rect = this.canvas.getBoundingClientRect()
        const sx = this.lastX - rect.left
        const sy = this.lastY - rect.top
        if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
          const world = screenToWorld(sx, sy, this.camera)
          navigator.vibrate?.([30, 60, 30])  // double-pulse distinguishes attack-move from rally
          this.onAttackMove?.(world.x, world.y)
          this.longPressFired = true
        }
      }, 500)
      emitLongPressStart(e.touches[0].clientX, e.touches[0].clientY)
    } else if (e.touches.length === 2) {
      // Cancel any pending long-press from the first finger
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
      this.isDragging = false
      const dx2 = e.touches[1].clientX - e.touches[0].clientX
      const dy2 = e.touches[1].clientY - e.touches[0].clientY
      const initDist = Math.sqrt(dx2 * dx2 + dy2 * dy2)
      this.lastPinchDist = initDist
      this.twoFingerTapStartDist = initDist
      this.twoFingerActive = true
      this.twoFingerMoved = false
    }
  }

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && this.lastPinchDist > 0) {
      // Pinch-to-zoom: compute new distance and zoom toward pinch midpoint
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const newDist = Math.sqrt(dx * dx + dy * dy)
      // If pinch distance changed significantly, this is a pinch not a tap
      if (Math.abs(newDist - this.twoFingerTapStartDist) > 15) {
        this.twoFingerMoved = true
      }
      const rawFactor = newDist / this.lastPinchDist
      const factor = 1 + (rawFactor - 1) * 0.4  // dampen to 40% of raw pinch speed
      const rect = this.canvas.getBoundingClientRect()
      const mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left
      const my = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top
      Object.assign(this.camera, zoomAt(this.camera, mx, my, factor))
      this.lastPinchDist = newDist
    } else if (e.touches.length === 1 && this.touchSelectMode && this.isDragSelect) {
      const rect = this.canvas.getBoundingClientRect()
      this.mouseX = e.touches[0].clientX - rect.left
      this.mouseY = e.touches[0].clientY - rect.top
    } else if (this.isDragging && e.touches.length === 1) {
      if (e.touches.length === 1) {
        const moveDist = Math.sqrt(
          (e.touches[0].clientX - this.touchStartX) ** 2 +
          (e.touches[0].clientY - this.touchStartY) ** 2
        )
        if (moveDist > 12 && this.longPressTimer) {
          clearTimeout(this.longPressTimer)
          this.longPressTimer = null
          emitLongPressCancel()
        }
      }
      this.camera.x += e.touches[0].clientX - this.lastX
      this.camera.y += e.touches[0].clientY - this.lastY
      this.lastX = e.touches[0].clientX
      this.lastY = e.touches[0].clientY
    }
  }

  private onTouchEnd = (e: TouchEvent) => {
    if (this.touchSelectMode) {
      this.touchSelectMode = false
      this.isDragSelect = false
      clearTimeout(this.longPressTimer!)
      this.longPressTimer = null
      const touch = e.changedTouches[0]
      const rect = this.canvas.getBoundingClientRect()
      const sx = touch.clientX - rect.left
      const sy = touch.clientY - rect.top
      const world = screenToWorld(sx, sy, this.camera)
      const dx = touch.clientX - this.touchStartX
      const dy = touch.clientY - this.touchStartY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 10) {
        this.onBoxSelect?.(this.dragSelectStartWorldX, this.dragSelectStartWorldY, world.x, world.y)
      } else {
        // Treat small movement as tap → rally
        this.onRally?.(world.x, world.y)
      }
      return
    }
    // Cancel any pending long-press
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
      emitLongPressCancel()
    }
    // Tap-to-rally / double-tap-to-zoom: only if long-press didn't fire
    if (!this.longPressFired && this.lastPinchDist === 0 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - this.touchStartX
      const dy = touch.clientY - this.touchStartY
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        const rect = this.canvas.getBoundingClientRect()
        const sx = touch.clientX - rect.left
        const sy = touch.clientY - rect.top
        if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
          const now = Date.now()
          const tapDx = touch.clientX - this.lastTapX
          const tapDy = touch.clientY - this.lastTapY
          const isDoubleTap = now - this.lastTapTime < 300 && Math.sqrt(tapDx * tapDx + tapDy * tapDy) < 40
          if (this.touchPatrolPending) {
            // Touch patrol mode: one-shot — fire patrol to this location
            this.touchPatrolPending = false
            const world = screenToWorld(sx, sy, this.camera)
            navigator.vibrate?.([10, 30, 10, 30, 10])  // triple-pulse for patrol
            this.onPatrol?.(world.x, world.y)
            emitTapRipple(touch.clientX, touch.clientY)
          } else if (isDoubleTap) {
            // Double-tap: zoom 1.5× toward tap point; if already zoomed in (≥1.5×), return to overview (0.7×)
            const factor = this.camera.zoom >= 1.5 ? (0.7 / this.camera.zoom) : 1.5
            Object.assign(this.camera, zoomAt(this.camera, sx, sy, factor))
            navigator.vibrate?.([12, 40, 12])  // double-pulse distinguishes from rally
            this.lastTapTime = 0  // reset so triple-tap doesn't chain
          } else {
            this.lastTapTime = now
            this.lastTapX = touch.clientX
            this.lastTapY = touch.clientY
            if (this.onRally) {
              const world = screenToWorld(sx, sy, this.camera)
              navigator.vibrate?.(18)  // short pulse confirms rally
              this.onRally(world.x, world.y)
              emitTapRipple(touch.clientX, touch.clientY)
            }
          }
        }
      }
    }
    // Two-finger tap → stop selected specks
    if (this.twoFingerActive && !this.twoFingerMoved && e.touches.length === 0) {
      navigator.vibrate?.([20, 30, 20])  // double-tap pattern — distinct from rally (18ms) and attack-move ([30,60,30])
      this.onStop?.()
    }
    // Reset two-finger state when all fingers lifted
    if (e.touches.length === 0) {
      this.twoFingerActive = false
      this.twoFingerMoved = false
    }
    this.isDragging = false
    this.lastPinchDist = 0
    this.longPressFired = false
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code)
  }

  isKeyHeld(code: string): boolean {
    return this.heldKeys.has(code)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Don't fire when typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    this.heldKeys.add(e.code)
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault()
    if (e.code === 'Space') {
      e.preventDefault()
      this.onTogglePause?.()
    } else if (e.code === 'Escape') {
      if (this.pendingModifier !== 'none') {
        this.pendingModifier = 'none'
        if (this.canvas) this.canvas.style.cursor = 'default'
      } else {
        this.onClearSelect?.()
      }
    } else if (e.code === 'KeyR') {
      this.onClearRally?.()
    } else if (e.code === 'KeyH') {
      this.onHold?.()
    } else if (e.code === 'KeyC') {
      this.onRecenterCamera?.()
    } else if (e.code === 'KeyD') {
      this.onDefend?.()
    } else if (e.code === 'KeyA' && e.ctrlKey) {
      e.preventDefault()
      this.onSelectAll?.()
    } else if (e.code === 'KeyA') {
      if (this.pendingModifier === 'attack') {
        this.pendingModifier = 'none'
        if (this.canvas) this.canvas.style.cursor = 'default'
      } else {
        this.pendingModifier = 'attack'
        if (this.canvas) this.canvas.style.cursor = 'crosshair'
      }
    } else if (e.code === 'KeyP') {
      if (this.pendingModifier === 'patrol') {
        this.pendingModifier = 'none'
        if (this.canvas) this.canvas.style.cursor = 'default'
      } else {
        this.pendingModifier = 'patrol'
        if (this.canvas) this.canvas.style.cursor = 'cell'
      }
    } else if (e.code === 'KeyS') {
      this.onStop?.()
    } else if (e.code === 'KeyT') {
      this.onBuildTurret?.()
    } else if (e.code === 'KeyN') {
      this.onAdvanceOutpost?.()
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
    } else if (e.code === 'KeyG') {
      this.onGuard?.()
    } else if (e.code === 'KeyZ' && !e.repeat) {
      this.onCycleStance?.()
    } else if (e.code === 'KeyX') {
      this.onCycleSpeed?.()
    } else if (e.code === 'KeyE') {
      this.onSelectAll?.()
    } else if (e.code === 'KeyY' && !e.repeat) {
      this.onCommanderAbility?.()
    } else if (e.code === 'KeyF') {
      this.onSacrifice?.()
    } else if (['Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].includes(e.code)) {
      const slot = parseInt(e.code.replace('Digit', ''))
      if (e.ctrlKey) {
        e.preventDefault()
        this.onSaveControlGroup?.(slot)
      } else {
        this.onRecallControlGroup?.(slot)
      }
    }
  }

  /** Activate one-shot touch patrol mode: next canvas tap fires patrol to that location */
  activateTouchPatrol() {
    this.touchPatrolPending = true
  }

  isTouchPatrolPending(): boolean {
    return this.touchPatrolPending
  }

  activateTouchSelectMode() {
    this.touchSelectMode = true
    this.isDragSelect = false
  }

  isTouchSelectModePending() {
    return this.touchSelectMode
  }

  getDragRect(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.isDragSelect) return null
    const rect = this.canvas.getBoundingClientRect()
    return {
      x1: this.mouseDownX - rect.left,
      y1: this.mouseDownY - rect.top,
      x2: this.mouseX,
      y2: this.mouseY,
    }
  }

  setPendingBuildActive(active: boolean) {
    this.pendingBuildActive = active
    this.canvas.style.cursor = active ? 'crosshair' : 'default'
  }
  getMouseScreenPos(): { x: number; y: number } | null {
    if (this.mouseX < 0) return null
    return { x: this.mouseX, y: this.mouseY }
  }

  destroy() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    window.removeEventListener('touchmove', this.onTouchMove)
    window.removeEventListener('touchend', this.onTouchEnd)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
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
