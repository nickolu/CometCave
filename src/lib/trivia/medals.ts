// Category medal system for infinite trivia.
//
// Each category has a custom 5-tier ladder of honorific titles, earned by
// answering questions correctly *in that category, scored mode only*. The
// thresholds are shared across all categories; only the labels vary.
//
// Storage and write-path wiring live in subsequent PRs — this file is
// config + pure helpers only.

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

const TIER_ORDER: Array<Exclude<MedalTier, 'none'>> = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
]

export const MEDAL_THRESHOLDS: Record<Exclude<MedalTier, 'none'>, number> = {
  bronze: 16,
  silver: 64,
  gold: 256,
  platinum: 1024,
  diamond: 4096,
}

// Per-category ladder. Index 0 = bronze, 4 = diamond. Keys match
// CATEGORY_META in src/lib/trivia/categories.ts.
export const CATEGORY_MEDAL_LADDERS: Record<number, [string, string, string, string, string]> = {
  9:  ['Curious',     'Student',       'Scholar',         'Sage',            'Polymath'],
  10: ['Reader',      'Bookworm',      'Scribe',          'Librarian',       'Bibliomancer'],
  11: ['Cinephile',   'Critic',        'Editor',          'Director',        'Auteur'],
  12: ['Listener',    'Performer',     'Composer',        'Conductor',       'Maestro'],
  13: ['Understudy',  'Ensemble',      'Lead',            'Director',        'Encore'],
  14: ['Viewer',      'Binger',        'Critic',          'Producer',        'Showrunner'],
  15: ['Player',      'Completionist', 'Speedrunner',     'Pro',             'Final Boss'],
  16: ['Pawn',        'Tactician',     'Strategist',      'Master',          'Grandmaster'],
  17: ['Hiker',       'Field Scout',   'Botanist',        'Specimen Keeper', 'Naturalist'],
  18: ['Hello World', 'Hacker',        'Coder',           'Sysadmin',        'The Compiler'],
  19: ['Counter',     'Solver',        'Theorist',        'Proofwriter',     'Axiom'],
  20: ['Mortal',      'Acolyte',       'Oracle',          'Demigod',         'Dreamweaver'],
  21: ['Rookie',      'Starter',       'All-Star',        'MVP',             'Hall of Fame'],
  22: ['Tourist',     'Wanderer',      'Explorer',        'Surveyor',        'Cartographer'],
  23: ['Witness',     'Student',       'Historian',       'Archivist',       'Chronicler'],
  24: ['Voter',       'Pundit',        'Strategist',      'Diplomat',        'President'],
  25: ['Doodler',     'Sketcher',      'Painter',         'Critic',          'Curator'],
  26: ['Fan',         'Stan',          'Paparazzi',       'Insider',         'Headline'],
  27: ['Petkeeper',   'Tracker',       'Zookeeper',       'Vet',             'Beastfriend'],
  28: ['Driver',      'Gearhead',      'Tuner',           'Engineer',        'The Mechanic'],
  29: ['Reader',      'Collector',     'Inker',           'Writer',          'Origin Story'],
  30: ['Unboxer',     'Hobbyist',      'Modder',          'Inventor',        'The Architect'],
  31: ['Bug Trainer', 'Krillin',       'Soul Reaper',     'Hokage',          'Truth'],
  32: ['Toon',        'Inker',         'Storyboarder',    'Director',        'The Animator'],
}

export function getMedalTier(correctCount: number): MedalTier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i]
    if (correctCount >= MEDAL_THRESHOLDS[tier]) return tier
  }
  return 'none'
}

export function getMedalLabel(categoryId: number, tier: MedalTier): string | null {
  if (tier === 'none') return null
  const ladder = CATEGORY_MEDAL_LADDERS[categoryId]
  if (!ladder) return null
  const idx = TIER_ORDER.indexOf(tier)
  if (idx === -1) return null
  return ladder[idx]
}

// Threshold required to reach the next tier from the given one.
// Returns null when already at the top (diamond).
export function getNextThreshold(tier: MedalTier): number | null {
  if (tier === 'diamond') return null
  if (tier === 'none') return MEDAL_THRESHOLDS.bronze
  const idx = TIER_ORDER.indexOf(tier)
  if (idx === -1 || idx === TIER_ORDER.length - 1) return null
  return MEDAL_THRESHOLDS[TIER_ORDER[idx + 1]]
}
