export const WORLD_WIDTH = 3000
export const WORLD_HEIGHT = 3000
export const GRID_CELL_SIZE = 100
export const GRID_COLS = Math.ceil(WORLD_WIDTH / GRID_CELL_SIZE)
export const GRID_ROWS = Math.ceil(WORLD_HEIGHT / GRID_CELL_SIZE)
export const HUD_UPDATE_INTERVAL = 10    // ticks
export const BASE_HP = 100
export const BASE_SIZE = 40
export const PLAYER_BASE_X = 600
export const PLAYER_BASE_Y = 1500
export const AI_BASE_X = 2400
export const AI_BASE_Y = 1500
export const PLAYER_COLOR = 0x4af7c4
export const AI_COLOR = 0xff4f7b
export const MAX_SPECKS = 15000

export const OUTPOST_SIZE = 20
export const OUTPOST_SPAWN_INTERVAL = 1800   // ms per speck (slower than base)
export const CAPTURE_RADIUS = 100            // px — specks within this distance count toward capture
export const CAPTURE_TIME = 5000             // ms to fully capture
export const NEUTRAL_COLOR = 0x888888
export const OUTPOST_AURA_RADIUS = 160  // px — specks within this radius of a friendly outpost move faster

// Triangle around center (1500, 1500), equidistant between the two bases
export const OUTPOST_POSITIONS = [
  { id: 'outpost-top',   x: 1500, y: 700  },
  { id: 'outpost-left',  x: 850,  y: 2200 },
  { id: 'outpost-right', x: 2150, y: 2200 },
] as const
