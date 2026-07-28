import { BUILDING_TYPES } from '../config/building-types'
import type { BuildingEntity, SimulationState, SpeckMeta } from '../types'

export const RALLY_MUSTER_RADIUS = 30   // px — spread allowed around an explicit rally point
const HOME_MUSTER_PADDING = 14          // px — clearance outside the building's own footprint

// The building a speck is still under standing orders from — null once it has been given a direct
// command (homeBuildingId cleared) or once that building has been destroyed or captured.
export function getHomeBuilding(sim: SimulationState, meta: SpeckMeta): BuildingEntity | null {
  if (!meta.homeBuildingId) return null
  const home = sim.buildings[meta.homeBuildingId]
  if (!home || home.ownerId !== meta.ownerId) return null
  return home
}

// How close is "arrived". Waiting specks muster in a loose ring rather than stacking on the exact
// pixel; at a building with no rally set the ring clears the building footprint so the muster
// doesn't bury the sprite. Shared by speck-ai (arrival test) and movement (stop-seeking test) so
// the two can never disagree and leave specks jittering on the boundary between them.
export function getMusterRadius(sim: SimulationState, meta: SpeckMeta): number {
  const home = getHomeBuilding(sim, meta)
  if (home && !home.rallyPoint) {
    return (BUILDING_TYPES[home.typeId]?.size ?? 20) + HOME_MUSTER_PADDING
  }
  return RALLY_MUSTER_RADIUS
}
