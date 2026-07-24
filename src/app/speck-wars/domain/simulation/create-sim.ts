import type { SimulationState, Player, BuildingEntity } from '../types'
import { PLAYER_BASE_X, PLAYER_BASE_Y, AI_BASE_X, AI_BASE_Y, PLAYER_COLOR, AI_COLOR, BASE_HP, MAX_SPECKS, NEUTRAL_COLOR, OUTPOST_POSITIONS } from '../constants'
import { SpatialGrid } from './spatial-grid'
import type { Difficulty } from '../../store'

const aiSpawnInterval: Record<Difficulty, number> = {
  easy: 2000,
  medium: 800,
  hard: 400,
}

const playerSpawnInterval: Record<Difficulty, number | undefined> = {
  easy: 550,   // faster on easy — the AI is already slow, this ensures clear advantage
  medium: undefined,  // use default (800ms)
  hard: undefined,    // use default (800ms) — player skill must compensate
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

  const outpostBuildings: Record<string, BuildingEntity> = {}
  for (const pos of OUTPOST_POSITIONS) {
    outpostBuildings[pos.id] = {
      id: pos.id,
      typeId: 'outpost',
      ownerId: 'neutral',
      x: pos.x, y: pos.y,
      hp: 50, maxHp: 50,
      spawnTimer: 0,
      inputBuffer: {},
    }
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
    rallyPoints: { player: null, ai: null },
    spatialGrid: new SpatialGrid(),
  }
}
