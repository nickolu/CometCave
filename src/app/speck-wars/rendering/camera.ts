import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_BASE_X, PLAYER_BASE_Y } from '../domain/constants'

export interface Camera {
  x: number      // stage offset x (screen space)
  y: number      // stage offset y (screen space)
  zoom: number
}

export function createCamera(canvasWidth: number, canvasHeight: number): Camera {
  // Start centered on the player's base
  return {
    x: canvasWidth / 2 - PLAYER_BASE_X,
    y: canvasHeight / 2 - PLAYER_BASE_Y,
    zoom: 1,
  }
}

export function screenToWorld(sx: number, sy: number, camera: Camera): { x: number; y: number } {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  }
}

export function worldToScreen(wx: number, wy: number, camera: Camera): { x: number; y: number } {
  return {
    x: wx * camera.zoom + camera.x,
    y: wy * camera.zoom + camera.y,
  }
}

// Zoom toward screen point (pinch/scroll zoom)
export function zoomAt(camera: Camera, screenX: number, screenY: number, factor: number): Camera {
  const newZoom = Math.max(0.2, Math.min(4, camera.zoom * factor))
  const scale = newZoom / camera.zoom
  return {
    zoom: newZoom,
    x: screenX - (screenX - camera.x) * scale,
    y: screenY - (screenY - camera.y) * scale,
  }
}

// Clamp camera so the world doesn't disappear off-screen completely.
// MARGIN is the minimum world pixels that must remain visible on each side.
const EDGE_MARGIN = 120  // px

export function clampCamera(camera: Camera, canvasWidth: number, canvasHeight: number): void {
  const ww = WORLD_WIDTH * camera.zoom
  const wh = WORLD_HEIGHT * camera.zoom
  camera.x = Math.min(camera.x, canvasWidth - EDGE_MARGIN)
  camera.x = Math.max(camera.x, EDGE_MARGIN - ww)
  camera.y = Math.min(camera.y, canvasHeight - EDGE_MARGIN)
  camera.y = Math.max(camera.y, EDGE_MARGIN - wh)
}
