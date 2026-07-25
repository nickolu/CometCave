import type { SpatialGrid } from './simulation/spatial-grid'

export interface SpeckMeta {
  id: string
  typeId: string
  ownerId: string
  state: 'idle' | 'moving' | 'attacking' | 'carrying' | 'sacrificing' | 'retreating' | 'holding'
  targetId: string | null
  attackCooldown: number   // ms remaining until next attack
  kills: number            // enemies killed; 3+ = veteran (gold ring, +20% damage)
  assignedRallyX?: number  // individual sub-group rally — persists after deselection
  assignedRallyY?: number
  holdPosition?: boolean   // true = don't move, don't attack, wait for new order
}

export interface BuildingEntity {
  id: string
  typeId: string
  ownerId: string
  x: number; y: number
  hp: number; maxHp: number
  spawnTimer: number       // ms until next spawn
  spawnIntervalOverride?: number  // overrides BUILDING_TYPES spawnInterval when set
  spawnTypeOverride?: string      // overrides BUILDING_TYPES spawnTypeId when set
  tripleOutpostBonus?: boolean    // true when owner controls all outposts (2× spawn)
  inputBuffer: Record<string, number>  // typeId → count (sacrifice system, future)
  captureProgress?: number      // 0..1 progress toward capture for captureSide
  captureSide?: string | null   // which player is currently winning capture
  fortifyDuration?: number      // ms continuously held — resets on capture
  lastDamagedAt?: number        // Date.now() timestamp of last damage taken (for regen cooldown)
}

export interface Player {
  id: string
  name: string
  color: number            // pixi hex e.g. 0x4af7c4
  isAI: boolean
  isDefeated: boolean
  stockpile: Record<string, number>  // typeId → count (resource form)
}

// SOA (Structure of Arrays) for hot speck data — cache-friendly for tight loops
export interface SimulationState {
  tick: number
  rngState: number

  players: Record<string, Player>
  buildings: Record<string, BuildingEntity>

  speckIds: string[]
  speckX: Float32Array
  speckY: Float32Array
  speckVx: Float32Array
  speckVy: Float32Array
  speckHp: Float32Array
  speckMeta: (SpeckMeta | null)[]   // parallel to speckIds; null means dead/unused slot
  speckCount: number       // high-water mark: indices 0..speckCount-1 may be live or freed
  freeSlots: number[]      // recycled slot indices from dead specks

  inputQueue: InputEvent[]
  events: SimEvent[]
  rallyPoints: Record<string, { x: number; y: number } | null>
  selectedSpeckIds: Set<string>  // IDs of player specks currently in selection
  spatialGrid: SpatialGrid
  dominationTimer: number    // ms of continuous triple-outpost control; resets on loss
  surgeDuration: number      // ms remaining in active surge, 0 = inactive
  surgeCooldown: number      // ms remaining before surge can be used again, 0 = ready
  dailyModifier: 'standard' | 'bulwark' | 'blitz' | 'siege'
  waveCountdown: number | null   // ms until next AI wave (null = waves disabled on this difficulty)
  waveInProgress: boolean        // true during the 15s wave assault
  sacrificeCooldown: number   // ms remaining before sacrifice can be used again, 0 = ready
}

export type InputEvent =
  | { type: 'RALLY'; ownerId: string; x: number; y: number }
  | { type: 'SET_SPAWN_TYPE'; ownerId: string; speckTypeId: string }
  | { type: 'BUILD'; ownerId: string; buildingTypeId: string; x: number; y: number }
  | { type: 'SACRIFICE'; ownerId: string; buildingId: string; typeId: string; count: number }
  | { type: 'BOX_SELECT'; ownerId: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'CLEAR_SELECT'; ownerId: string }
  | { type: 'SURGE'; ownerId: string }
  | { type: 'STOP'; ownerId: string }
  | { type: 'HOLD'; ownerId: string }

export type SimEvent =
  | { type: 'SPECK_DIED'; speckId: string; x: number; y: number; killedOwnerId: string; killerOwnerId: string }
  | { type: 'BUILDING_DAMAGED'; buildingId: string; hp: number }
  | { type: 'BUILDING_DESTROYED'; buildingId: string; ownerId: string; x: number; y: number }
  | { type: 'SPECK_SPAWNED'; speckId: string; buildingId: string }
  | { type: 'GAME_OVER'; winnerId: string; victoryType: 'destruction' | 'domination' }
  | { type: 'HUD_UPDATE'; data: HudData }
  | { type: 'OUTPOST_CAPTURED'; outpostId: string; newOwner: string; previousOwner: string }
  | { type: 'SPECK_VETERAN'; speckId: string; ownerId: string }
  | { type: 'SPECK_ELITE'; speckId: string; ownerId: string }
  | { type: 'AI_WAVE_START'; waveNumber: number }
  | { type: 'VETERAN_FALLEN'; speckId: string; ownerId: string; kills: number; x: number; y: number }
  | { type: 'AI_LAST_STAND' }
  | { type: 'AI_SPAWN_SWITCH'; speckTypeId: 'basic' | 'heavy' | 'scout' }

export interface HudData {
  players: Record<string, {
    speckCount: number
    buildingCount: number
    buildingHp: Record<string, number>
    speckTypes: Record<string, number>  // typeId → count
    veteranCount: number  // specks with 3+ kills
    eliteCount: number    // specks with 6+ kills
  }>
  attackedBuildingIds: string[]
  tripleOutpostOwner: string | null  // player ID who owns all 3 outposts, or null
  dominationProgress: number | null  // 0..1 fraction of DOMINATION_TIME elapsed; null if no triple holder
  captureInfo: Record<string, { progress: number; side: string } | null>  // outpostId → active capture
  surgeDuration: number    // ms remaining in active surge
  surgeCooldown: number    // ms remaining before surge can be used again
  selectedSpeckCount: number   // 0 when no selection active
  selectedComposition: { types: Record<string, number>; veteranCount: number; eliteCount: number } | null
  spawnRates: Record<string, number>   // playerId → effective specks/min
  dailyModifier: 'standard' | 'bulwark' | 'blitz' | 'siege'
  waveCountdown: number | null
  waveInProgress: boolean
  sacrificeCooldown: number
  baseUnderThreat: boolean
  enemyAdvanceDetected: boolean
  rallyCryActive: boolean
  outpostFortify: Record<string, number>  // outpostId → 0..1 fortification level
  minimap: {
    specks: { x: number; y: number; ownerId: string }[]
    buildings: { id: string; x: number; y: number; ownerId: string; typeId: string }[]
    rallyPoint: { x: number; y: number } | null
    aiRallyPoint: { x: number; y: number } | null
  }
}
