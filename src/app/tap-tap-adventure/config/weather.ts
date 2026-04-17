export type WeatherId = 'clear' | 'rain' | 'storm' | 'fog' | 'blizzard' | 'sandstorm' | 'heat_wave'

export interface WeatherType {
  id: WeatherId
  name: string
  icon: string
  description: string
  /** Accuracy penalty for enemy attacks (0.0–0.15). Positive = more misses. */
  accuracyMod: number
  /** Flat addition to player crit chance */
  critChanceMod: number
  /** Elemental damage multiplier modifier (0 = no effect, 0.1 = +10%) */
  fireDamageMod: number
  iceDamageMod: number
  lightningDamageMod: number
}

export type RegionWeatherPool = Record<string, number>

export const WEATHER_TYPES: Record<WeatherId, WeatherType> = {
  clear: {
    id: 'clear',
    name: 'Clear Skies',
    icon: '\u2600\uFE0F',
    description: 'Bright sun and clear skies — perfect adventuring weather.',
    accuracyMod: 0,
    critChanceMod: 0,
    fireDamageMod: 0,
    iceDamageMod: 0,
    lightningDamageMod: 0,
  },
  rain: {
    id: 'rain',
    name: 'Rain',
    icon: '\uD83C\uDF27\uFE0F',
    description: 'Steady rain soaks everything, reducing visibility and footing.',
    accuracyMod: 0.05,
    critChanceMod: 0,
    fireDamageMod: 0,
    iceDamageMod: 0,
    lightningDamageMod: 0,
  },
  storm: {
    id: 'storm',
    name: 'Thunderstorm',
    icon: '\u26C8\uFE0F',
    description: 'Thunder rolls and lightning splits the sky. Electricity crackles in the air.',
    accuracyMod: 0.10,
    critChanceMod: 0.05,
    fireDamageMod: 0,
    iceDamageMod: 0,
    lightningDamageMod: 0.20,
  },
  fog: {
    id: 'fog',
    name: 'Dense Fog',
    icon: '\uD83C\uDF2B\uFE0F',
    description: 'A thick fog blankets the land — enemies strike blindly from the murk.',
    accuracyMod: 0.15,
    critChanceMod: 0,
    fireDamageMod: 0,
    iceDamageMod: 0,
    lightningDamageMod: 0,
  },
  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    icon: '\uD83C\uDF28\uFE0F',
    description: 'A blizzard howls — ice crystals sting exposed skin and numb extremities.',
    accuracyMod: 0.10,
    critChanceMod: 0,
    fireDamageMod: -0.10,
    iceDamageMod: 0.15,
    lightningDamageMod: 0,
  },
  sandstorm: {
    id: 'sandstorm',
    name: 'Sandstorm',
    icon: '\uD83C\uDFDC\uFE0F',
    description: 'Blinding sand fills the air, choking lungs and scouring exposed skin.',
    accuracyMod: 0.10,
    critChanceMod: 0,
    fireDamageMod: 0,
    iceDamageMod: 0,
    lightningDamageMod: 0,
  },
  heat_wave: {
    id: 'heat_wave',
    name: 'Heat Wave',
    icon: '\uD83D\uDD25',
    description: 'Scorching heat radiates from the ground — flames burn hotter, cold magic weakens.',
    accuracyMod: 0,
    critChanceMod: 0,
    fireDamageMod: 0.10,
    iceDamageMod: -0.10,
    lightningDamageMod: 0,
  },
}

/** Weighted weather pools per region. Keys must match region IDs in config/regions.ts */
export const REGION_WEATHER_POOLS: Record<string, RegionWeatherPool> = {
  starting_village: { clear: 10 },
  green_meadows: { clear: 5, rain: 3, storm: 1, fog: 1 },
  dark_forest: { clear: 2, fog: 5, rain: 3, storm: 1 },
  crystal_caves: { clear: 5, fog: 3, blizzard: 2 },
  scorched_wastes: { clear: 3, sandstorm: 4, heat_wave: 3 },
  frozen_peaks: { clear: 5, blizzard: 3, storm: 2 },
  shadow_realm: { clear: 1, fog: 5, storm: 4 },
  sky_citadel: { clear: 5, storm: 4, rain: 1 },
  abyssal_depths: { clear: 2, fog: 6, storm: 2 },
  celestial_throne: { clear: 6, storm: 3, heat_wave: 1 },
  sunken_ruins: { clear: 3, rain: 4, fog: 3 },
  volcanic_forge: { clear: 2, heat_wave: 5, sandstorm: 3 },
  feywild_grove: { clear: 4, rain: 3, fog: 3 },
  bone_wastes: { clear: 3, fog: 4, storm: 3 },
  dragons_spine: { clear: 2, storm: 4, heat_wave: 2, sandstorm: 2 },
}

export const WEATHER_CHANGE_INTERVAL = 25

/**
 * Roll a weighted random weather ID for the given region.
 * Falls back to 'clear' for unknown regions.
 */
export function rollWeather(regionId: string): WeatherId {
  const pool = REGION_WEATHER_POOLS[regionId] ?? { clear: 1 }
  const entries = Object.entries(pool)
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * totalWeight
  for (const [id, weight] of entries) {
    roll -= weight
    if (roll <= 0) return id as WeatherId
  }
  return 'clear'
}

/**
 * Get a WeatherType by ID, falling back to 'clear' for unknown IDs.
 */
export function getWeatherType(weatherId: string): WeatherType {
  return WEATHER_TYPES[weatherId as WeatherId] ?? WEATHER_TYPES.clear
}
