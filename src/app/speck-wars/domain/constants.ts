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
export const OUTPOST_SPAWN_INTERVAL = 1200   // ms per speck — fast enough to make outpost control strategically decisive
export const CAPTURE_RADIUS = 100            // px — specks within this distance count toward capture
export const CAPTURE_TIME = 5000             // ms to fully capture
export const NEUTRAL_COLOR = 0x888888
export const OUTPOST_AURA_RADIUS = 160  // px — specks within this radius of a friendly outpost move faster
export const DOMINATION_TIME = 60000   // ms — hold all 3 outposts this long to win by domination
export const RALLY_CRY_HP_THRESHOLD = 0.25  // base HP fraction below which Rally Cry activates (1.5× spawn)

// Three map layouts — one is picked per game using the daily seed.
// All layouts use the same outpost IDs so the rest of the codebase is layout-agnostic.
export const MAP_LAYOUTS = [
  // Layout 0 — Triangle: top-center sentinel + two base-side flanks
  [
    { id: 'outpost-top',   x: 1500, y: 700  },
    { id: 'outpost-left',  x: 850,  y: 2200 },
    { id: 'outpost-right', x: 2150, y: 2200 },
  ],
  // Layout 1 — Corridor: diagonal lane from player corner to AI corner
  [
    { id: 'outpost-top',   x: 1050, y: 1100 },
    { id: 'outpost-left',  x: 1500, y: 1500 },
    { id: 'outpost-right', x: 1950, y: 1900 },
  ],
  // Layout 2 — Wings: horizontal spread, forces split attention
  [
    { id: 'outpost-top',   x: 1500, y: 950  },
    { id: 'outpost-left',  x: 950,  y: 1500 },
    { id: 'outpost-right', x: 2050, y: 1500 },
  ],
] as const

export const OUTPOST_POSITIONS = MAP_LAYOUTS[0]  // default — overridden by createSim seed
