import type { SimulationState, SpeckMeta } from '../types'
import { SPECK_TYPES } from '../config/speck-types'
import { MAX_SPECKS } from '../constants'

const WORLD_SIZE = 3000
const SPAWN_MARGIN = 50

function randomEdgePosition(): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { x: Math.random() * WORLD_SIZE, y: SPAWN_MARGIN }              // top
    case 1: return { x: Math.random() * WORLD_SIZE, y: WORLD_SIZE - SPAWN_MARGIN } // bottom
    case 2: return { x: SPAWN_MARGIN, y: Math.random() * WORLD_SIZE }              // left
    default: return { x: WORLD_SIZE - SPAWN_MARGIN, y: Math.random() * WORLD_SIZE } // right
  }
}

let survivalSpeckCounter = 0

function spawnEnemyWave(sim: SimulationState) {
  const playerBase = Object.values(sim.buildings).find(b => b.ownerId === 'player' && b.typeId === 'base')
  if (!playerBase) return
  // Wave size scales: 8 + waveNumber*4
  const waveSize = 8 + sim.survivalWaveNumber * 4
  const speckTypeId = sim.survivalWaveNumber > 5 ? 'heavy' : 'basic'
  const stype = SPECK_TYPES[speckTypeId]
  for (let i = 0; i < waveSize; i++) {
    const { x, y } = randomEdgePosition()
    const meta: SpeckMeta = {
      id: `sv-${++survivalSpeckCounter}`,
      typeId: speckTypeId,
      ownerId: 'ai',
      state: 'moving',
      targetId: null,
      attackCooldown: 0,
      kills: 0,
      assignedRallyX: playerBase.x,
      assignedRallyY: playerBase.y,
    }
    let slot: number
    if (sim.freeSlots.length > 0) {
      slot = sim.freeSlots.pop()!
    } else if (sim.speckCount < MAX_SPECKS) {
      slot = sim.speckCount++
    } else {
      break
    }
    sim.speckX[slot] = x
    sim.speckY[slot] = y
    sim.speckVx[slot] = 0
    sim.speckVy[slot] = 0
    sim.speckHp[slot] = stype.hp
    sim.speckIds[slot] = meta.id
    sim.speckMeta[slot] = meta
  }
}

export function updateSurvivalSpawner(sim: SimulationState, dt: number) {
  if (!sim.isSurvival) return

  // Tick survival countdown
  if (sim.survivalTimeRemaining > 0) {
    sim.survivalTimeRemaining = Math.max(0, sim.survivalTimeRemaining - dt)
  }

  // Tick wave remaining timer
  if (sim.survivalWaveRemainingMs > 0) {
    sim.survivalWaveRemainingMs = Math.max(0, sim.survivalWaveRemainingMs - dt)
  }

  sim.waveInProgress = sim.survivalWaveRemainingMs > 0

  if (sim.survivalWaveRemainingMs === 0) {
    sim.survivalWaveTimer -= dt
    if (sim.survivalWaveTimer <= 0) {
      sim.survivalWaveNumber++
      sim.waveNumber = sim.survivalWaveNumber
      spawnEnemyWave(sim)
      sim.survivalWaveRemainingMs = 20000     // wave lasts 20s
      sim.survivalWaveTimer = 25000           // break before next wave
      sim.waveInProgress = true
      sim.events.push({ type: 'AI_WAVE_START', waveNumber: sim.survivalWaveNumber })
      sim.waveCountdown = 25000
    } else {
      sim.waveCountdown = sim.survivalWaveTimer
    }
  }
}
