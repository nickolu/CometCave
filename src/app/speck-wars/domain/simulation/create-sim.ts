import type { SimulationState, Player, BuildingEntity } from '../types'
import { PLAYER_BASE_X, PLAYER_BASE_Y, AI_BASE_X, AI_BASE_Y, PLAYER_COLOR, AI_COLOR, BASE_HP, MAX_SPECKS, NEUTRAL_COLOR, DAILY_MODIFIER_POOL } from '../constants'
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

function generateOutpostPositions(count: number, rng: () => number) {
  // Outposts spread across the center zone, avoiding base flanks
  const X_MIN = 850, X_MAX = 2150
  const Y_MIN = 550, Y_MAX = 2450

  const cols = Math.ceil(Math.sqrt(count * 1.5))
  const rows = Math.ceil(count / cols)
  const cellW = (X_MAX - X_MIN) / cols
  const cellH = (Y_MAX - Y_MIN) / rows

  // Build all cells
  const cells: { x: number; y: number }[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: X_MIN + cellW * (col + 0.5),
        y: Y_MIN + cellH * (row + 0.5),
      })
    }
  }

  // Fisher-Yates shuffle with seeded rng
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]]
  }

  // Take first `count`, add jitter up to 30% of cell size
  const jitter = Math.min(cellW, cellH) * 0.3
  return cells.slice(0, count).map(c => ({
    x: Math.round(c.x + (rng() * 2 - 1) * jitter),
    y: Math.round(c.y + (rng() * 2 - 1) * jitter),
  }))
}

function generateBasePositions(count: number, isPlayer: boolean) {
  const x = isPlayer ? PLAYER_BASE_X : AI_BASE_X
  if (count === 1) return [{ x, y: 1500 }]
  const spacing = Math.min(500, 2000 / (count + 1))
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: Math.round(1500 - (spacing * (count - 1) / 2) + spacing * i),
  }))
}

export function createSim(seed: number = Date.now(), difficulty: Difficulty = 'medium', outpostCount = 3, baseCount = 1): SimulationState {
  const rng = mulberry32(seed)  // seeded so same date+difficulty = same map

  // Generate base positions for both sides
  const playerBasePositions = generateBasePositions(baseCount, true)
  const aiBasePositions = generateBasePositions(baseCount, false)

  const playerBases: BuildingEntity[] = playerBasePositions.map((pos, i) => ({
    id: i === 0 ? 'building-player-base' : `building-player-base-${i}`,
    typeId: 'base',
    ownerId: 'player',
    x: pos.x, y: pos.y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
    spawnIntervalOverride: playerSpawnInterval[difficulty],
    inputBuffer: {},
  }))

  const aiBases: BuildingEntity[] = aiBasePositions.map((pos, i) => ({
    id: i === 0 ? 'building-ai-base' : `building-ai-base-${i}`,
    typeId: 'base',
    ownerId: 'ai',
    x: pos.x, y: pos.y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
    spawnIntervalOverride: aiSpawnInterval[difficulty],
    inputBuffer: {},
  }))

  const player: Player = {
    id: 'player', name: 'Player',
    color: PLAYER_COLOR, isAI: false, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive',
  }
  const ai: Player = {
    id: 'ai', name: 'AI',
    color: AI_COLOR, isAI: true, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive',
  }
  const neutral: Player = {
    id: 'neutral', name: 'Neutral',
    color: NEUTRAL_COLOR, isAI: false, isDefeated: false, stockpile: {},
    totalKills: 0, upgradeLevel: 0, stance: 'defensive',
  }

  // Generate outpost positions using seeded rng
  const outpostPositions = generateOutpostPositions(outpostCount, rng)
  const outpostBuildings: Record<string, BuildingEntity> = {}
  outpostPositions.forEach((pos, i) => {
    const id = `outpost-${i}`
    outpostBuildings[id] = {
      id,
      typeId: 'outpost',
      ownerId: 'neutral',
      x: pos.x, y: pos.y,
      hp: 50, maxHp: 50,
      spawnTimer: 0,
      inputBuffer: {},
    }
  })

  // Pick daily modifier — LAST RNG call so it doesn't shift outpost layout
  const modifierIndex = Math.floor(rng() * DAILY_MODIFIER_POOL.length)
  const dailyModifier: DailyModifier = DAILY_MODIFIER_POOL[modifierIndex]

  // Build the buildings record with bases first then outposts
  const buildingsRecord: Record<string, BuildingEntity> = {}
  for (const b of playerBases) buildingsRecord[b.id] = b
  for (const b of aiBases) buildingsRecord[b.id] = b
  Object.assign(buildingsRecord, outpostBuildings)

  // Apply static modifier effects to all bases
  if (dailyModifier === 'bulwark') {
    for (const b of [...playerBases, ...aiBases]) {
      b.hp = BASE_HP * 2
      b.maxHp = BASE_HP * 2
    }
  }
  if (dailyModifier === 'blitz') {
    const DEFAULT_BASE_INTERVAL = 800  // BUILDING_TYPES.base.spawnInterval
    for (const b of [...playerBases, ...aiBases]) {
      b.spawnIntervalOverride = (b.spawnIntervalOverride ?? DEFAULT_BASE_INTERVAL) * 0.65
    }
  }

  return {
    tick: 0,
    rngState: seed,
    players: { player, ai, neutral },
    buildings: buildingsRecord,
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
