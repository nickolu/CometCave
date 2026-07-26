import type { SimulationState, Player, BuildingEntity, WallObstacle } from '../types'
import { PLAYER_BASE_X, PLAYER_BASE_Y, AI_BASE_X, AI_BASE_Y, PLAYER_COLOR, AI_COLOR, BASE_HP, MAX_SPECKS, NEUTRAL_COLOR, MAP_LAYOUTS, DAILY_MODIFIER_POOL } from '../constants'
import type { DailyModifier } from '../constants'
import { SpatialGrid } from './spatial-grid'
import { mulberry32 } from './prng'
import type { Difficulty } from '../../store'
import { spawnCampDefenders, spawnCommander } from './spawner'

function generateObstacles(rng: () => number): WallObstacle[] {
  const obstacles: WallObstacle[] = []
  const count = 2 + Math.floor(rng() * 3)  // 2, 3, or 4
  const BASE_A = { x: 600, y: 1500 }
  const BASE_B = { x: 2400, y: 1500 }
  const SAFE_RADIUS = 780  // keep obstacles away from bases

  for (let attempt = 0; obstacles.length < count; attempt++) {
    if (attempt > 60) break
    const cx = 900 + rng() * 1200   // mid-field: 900–2100
    const cy = 750 + rng() * 1500   // mid-field: 750–2250
    const distA = Math.hypot(cx - BASE_A.x, cy - BASE_A.y)
    const distB = Math.hypot(cx - BASE_B.x, cy - BASE_B.y)
    if (distA < SAFE_RADIUS || distB < SAFE_RADIUS) continue
    const w = 80 + rng() * 140     // 80–220px wide
    const h = 60 + rng() * 100     // 60–160px tall
    obstacles.push({ x: cx - w / 2, y: cy - h / 2, w, h })
  }
  return obstacles
}

const aiSpawnInterval: Record<Difficulty, number> = {
  easy: 2000,
  medium: 800,
  hard: 400,
  'very-hard': 180,  // blazing spawn rate — AI floods the map
}

const playerSpawnInterval: Record<Difficulty, number | undefined> = {
  easy: 550,         // faster on easy — the AI is already slow, this ensures clear advantage
  medium: undefined, // use default (800ms)
  hard: undefined,   // use default (800ms) — player skill must compensate
  'very-hard': undefined,  // same as hard — no advantage
}

export function createSim(seed: number = Date.now(), difficulty: Difficulty = 'medium'): SimulationState {
  const playerBase: BuildingEntity = {
    id: 'building-player-base',
    typeId: 'base',
    ownerId: 'player',
    x: PLAYER_BASE_X, y: PLAYER_BASE_Y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
    spawnIntervalOverride: playerSpawnInterval[difficulty],
    inputBuffer: {},
  }
  const aiBase: BuildingEntity = {
    id: 'building-ai-base',
    typeId: 'base',
    ownerId: 'ai',
    x: AI_BASE_X, y: AI_BASE_Y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
    spawnIntervalOverride: aiSpawnInterval[difficulty],
    inputBuffer: {},
  }

  const player: Player = {
    id: 'player', name: 'Player',
    color: PLAYER_COLOR, isAI: false, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive', creepCampBoostMs: 0,
    outpostUpgrades: { carapace: false, blades: false, afterburners: false },
  }
  const ai: Player = {
    id: 'ai', name: 'AI',
    color: AI_COLOR, isAI: true, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive', creepCampBoostMs: 0,
    outpostUpgrades: { carapace: false, blades: false, afterburners: false },
  }
  const neutral: Player = {
    id: 'neutral', name: 'Neutral',
    color: NEUTRAL_COLOR, isAI: false, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive', creepCampBoostMs: 0,
    outpostUpgrades: { carapace: false, blades: false, afterburners: false },
  }

  const JITTER = 150  // ± px of positional variation per game
  const rng = mulberry32(seed)  // seeded so same date+difficulty = same map
  // Pick layout using first RNG call so same seed = same layout + same jitter
  const layoutIndex = Math.floor(rng() * MAP_LAYOUTS.length)
  const outpostPositions = MAP_LAYOUTS[layoutIndex]
  const outpostBuildings: Record<string, BuildingEntity> = {}
  for (const pos of outpostPositions) {
    const jx = (rng() * 2 - 1) * JITTER
    const jy = (rng() * 2 - 1) * JITTER
    outpostBuildings[pos.id] = {
      id: pos.id,
      typeId: 'outpost',
      ownerId: 'neutral',
      x: pos.x + jx, y: pos.y + jy,
      hp: 50, maxHp: 50,
      spawnTimer: 0,
      inputBuffer: {},
    }
  }

  // Add creep camps at fixed positions
  const campPositions = [
    { id: 'camp-north', x: 1100, y: 900 },
    { id: 'camp-south', x: 1900, y: 2100 },
  ]
  const campBuildings: Record<string, BuildingEntity> = {}
  for (const pos of campPositions) {
    campBuildings[pos.id] = {
      id: pos.id,
      typeId: 'creep_camp',
      ownerId: 'neutral',
      x: pos.x, y: pos.y,
      hp: 40, maxHp: 40,
      spawnTimer: 0,
      inputBuffer: {},
    }
  }

  // Pick daily modifier — after layout and jitter RNG calls
  const modifierIndex = Math.floor(rng() * DAILY_MODIFIER_POOL.length)
  const dailyModifier: DailyModifier = DAILY_MODIFIER_POOL[modifierIndex]

  // Generate obstacles AFTER modifier pick to avoid shifting existing RNG sequence
  const obstacles = generateObstacles(rng)

  // Apply static modifier effects
  if (dailyModifier === 'bulwark') {
    playerBase.hp = BASE_HP * 2
    playerBase.maxHp = BASE_HP * 2
    aiBase.hp = BASE_HP * 2
    aiBase.maxHp = BASE_HP * 2
  }
  if (dailyModifier === 'blitz') {
    const DEFAULT_BASE_INTERVAL = 800  // BUILDING_TYPES.base.spawnInterval
    playerBase.spawnIntervalOverride = (playerBase.spawnIntervalOverride ?? DEFAULT_BASE_INTERVAL) * 0.65
    aiBase.spawnIntervalOverride = (aiBase.spawnIntervalOverride ?? DEFAULT_BASE_INTERVAL) * 0.65
  }

  const sim: SimulationState = {
    tick: 0,
    rngState: seed,
    players: { player, ai, neutral },
    buildings: { 'building-player-base': playerBase, 'building-ai-base': aiBase, ...outpostBuildings, ...campBuildings },
    speckIds: new Array(MAX_SPECKS).fill(''),
    speckX: new Float32Array(MAX_SPECKS),
    speckY: new Float32Array(MAX_SPECKS),
    speckVx: new Float32Array(MAX_SPECKS),
    speckVy: new Float32Array(MAX_SPECKS),
    speckHp: new Float32Array(MAX_SPECKS),
    speckMeta: new Array(MAX_SPECKS).fill(null),
    speckCount: 0,
    freeSlots: [],
    inputQueue: [],
    events: [],
    rallyPoints: { player: null, ai: null, 'player-selected': null },
    selectedSpeckIds: new Set<string>(),
    selectedBuildingId: null,
    spatialGrid: new SpatialGrid(),
    heroRespawnTimer: { player: 0, ai: 0 },
    dominationTimer: 0,
    surgeDuration: 0,
    surgeCooldown: 0,
    dailyModifier,
    waveCountdown: null,
    waveInProgress: false,
    sacrificeCooldown: 0,
    obstacles,
  }

  // Spawn initial defenders for each creep camp
  for (const pos of campPositions) {
    spawnCampDefenders(sim, pos.id)
  }

  // Spawn one commander per side
  spawnCommander(sim, 'player')
  spawnCommander(sim, 'ai')

  return sim
}
