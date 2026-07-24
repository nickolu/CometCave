import type { SimulationState, Player, BuildingEntity } from '../types'
import { PLAYER_BASE_X, PLAYER_BASE_Y, AI_BASE_X, AI_BASE_Y, PLAYER_COLOR, AI_COLOR, BASE_HP, MAX_SPECKS } from '../constants'
import { SpatialGrid } from './spatial-grid'

export function createSim(seed: number = Date.now()): SimulationState {
  const playerBase: BuildingEntity = {
    id: 'building-player-base',
    typeId: 'base',
    ownerId: 'player',
    x: PLAYER_BASE_X, y: PLAYER_BASE_Y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
    inputBuffer: {},
  }
  const aiBase: BuildingEntity = {
    id: 'building-ai-base',
    typeId: 'base',
    ownerId: 'ai',
    x: AI_BASE_X, y: AI_BASE_Y,
    hp: BASE_HP, maxHp: BASE_HP,
    spawnTimer: 0,
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

  return {
    tick: 0,
    rngState: seed,
    players: { player, ai },
    buildings: { 'building-player-base': playerBase, 'building-ai-base': aiBase },
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
