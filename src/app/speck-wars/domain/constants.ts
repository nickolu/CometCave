export const WORLD_WIDTH = 3000
export const WORLD_HEIGHT = 3000
export const GRID_CELL_SIZE = 100
export const GRID_COLS = Math.ceil(WORLD_WIDTH / GRID_CELL_SIZE)
export const GRID_ROWS = Math.ceil(WORLD_HEIGHT / GRID_CELL_SIZE)
export const HUD_UPDATE_INTERVAL = 10    // ticks
export const BASE_HP = 100
export const PLAYER_BASE_X = 600
export const PLAYER_BASE_Y = 1500
export const AI_BASE_X = 2400
export const AI_BASE_Y = 1500
export const PLAYER_COLOR = 0x4af7c4
export const AI_COLOR = 0xff4f7b
export const MAX_SPECKS = 15000

export const OUTPOST_SIZE = 20
export const CAPTURE_RADIUS = 100            // px — specks within this distance count toward capture
export const CAPTURE_TIME = 5000             // ms to fully capture
export const CREEP_CAMP_DEFENDER_COUNT = 6
export const CREEP_CAMP_ZONE_RADIUS = 120       // leash radius for defenders
export const CREEP_CAMP_RESET_MS = 90000        // ms before captured camp resets
export const CREEP_CAMP_BOOST_MS = 30000        // ms of +25% spawn boost
export const CREEP_CAMP_BOOST_MULT = 1.25       // spawn speed multiplier from boost
export const NEUTRAL_COLOR = 0x888888
export const OUTPOST_AURA_RADIUS = 160  // px — specks within this radius of a friendly outpost move faster
export const DOMINATION_TIME = 60000   // ms — hold all 3 outposts this long to win by domination
export const RALLY_CRY_HP_THRESHOLD = 0.25  // base HP fraction below which Rally Cry activates (1.5× spawn)

// Supply pressure thresholds
export const SUPPLY_SOFT_CAP = 60   // above this: spawn timers scale up
export const SUPPLY_HARD_CAP = 120  // above this: non-base spawning halted

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

// Human-readable names for each map layout (index matches MAP_LAYOUTS)
export const MAP_LAYOUT_NAMES: string[] = ['Triangle', 'Corridor', 'Wings']

export const FORTIFY_TIME = 30000        // ms to reach full fortification
export const FORTIFY_RADIUS = 200        // px — combat bonus applies within this radius
export const FORTIFY_DAMAGE_BONUS = 0.25 // max damage multiplier bonus when fully fortified

// Fog of war
export const FOG_ALPHA = 0.85
export const FOG_CELL_SIZE = 200        // coarse grid cell size for speck vision
export const FOG_VISION_SPECK = 150     // px vision radius per speck (coarse cell)
export const FOG_VISION_BASE = 300      // px vision radius around player base
export const FOG_VISION_BUILDING = 180  // px vision radius around owned outposts/buildings

export type DailyModifier = 'standard' | 'bulwark' | 'blitz' | 'siege'

// Weighted array: standard appears 2× more often than others
export const DAILY_MODIFIER_POOL: DailyModifier[] = [
  'standard', 'standard', 'bulwark', 'blitz', 'siege'
]

export const DAILY_MODIFIER_LABELS: Record<DailyModifier, string> = {
  standard: '',
  bulwark:  '⚔ BULWARK — bases have 2× HP',
  blitz:    '⚡ BLITZ — 1.5× production speed',
  siege:    '🏰 SIEGE — outposts take 2× longer to capture',
}
