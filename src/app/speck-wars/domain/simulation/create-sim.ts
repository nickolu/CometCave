import type { SimulationState, Player, BuildingEntity } from '../types'
import { PLAYER_BASE_X, PLAYER_BASE_Y, AI_BASE_X, AI_BASE_Y, PLAYER_COLOR, AI_COLOR, BASE_HP, MAX_SPECKS, NEUTRAL_COLOR, MAP_LAYOUTS, DAILY_MODIFIER_POOL } from '../constants'
import type { DailyModifier } from '../constants'
import { SpatialGrid } from './spatial-grid'
import { mulberry32 } from './prng'
import type { Difficulty } from '../../store'

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
  }
  const ai: Player = {
    id: 'ai', name: 'AI',
    color: AI_COLOR, isAI: true, isDefeated: false, stockpile: {},
  }
  const neutral: Player = {
    id: 'neutral', name: 'Neutral',
    color: NEUTRAL_COLOR, isAI: false, isDefeated: false, stockpile: {},
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

  // Pick daily modifier — LAST RNG call so it doesn't shift existing map layout or jitter
  const modifierIndex = Math.floor(rng() * DAILY_MODIFIER_POOL.length)
  const dailyModifier: DailyModifier = DAILY_MODIFIER_POOL[modifierIndex]

  // Apply static modifier effects
  if (dailyModifier === 'bulwark') {
    playerBase.hp = BASE_HP * 2
    playerBase.maxHp = BASE_HP * 2
    aiBase.hp = BASE_HP * 2
    aiBase.maxHp = BASE_HP * 2
  }
  if (dailyModifier === 'blitz') {
    if (playerBase.spawnIntervalOverride !== undefined) playerBase.spawnIntervalOverride *= 0.65
    aiBase.spawnIntervalOverride = (aiBase.spawnIntervalOverride ?? 800) * 0.65
  }

  return {
    tick: 0,
    rngState: seed,
    players: { player, ai, neutral },
    buildings: { 'building-player-base': playerBase, 'building-ai-base': aiBase, ...outpostBuildings },
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
    dominationTimer: 0,
    surgeDuration: 0,
    surgeCooldown: 0,
    dailyModifier,
    waveCountdown: null,
    waveInProgress: false,
    sacrificeCooldown: 0,
  }
}
