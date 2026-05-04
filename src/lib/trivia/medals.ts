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

// Pure tier-up detection. Returns the medal earned at this answer, or null
// if no tier line was crossed. categoryId must be a known category;
// otherwise null.
export function detectMedalEarned(
  prevCorrectCount: number,
  newCorrectCount: number,
  categoryId: number
): { tier: MedalTier; label: string } | null {
  const prevTier = getMedalTier(prevCorrectCount)
  const newTier = getMedalTier(newCorrectCount)
  if (newTier === prevTier) return null
  if (newTier === 'none') return null
  const label = getMedalLabel(categoryId, newTier)
  if (!label) return null
  return { tier: newTier, label }
}

// Stored shape at users/{uid}/triviaCategoryStats/{categoryId}.
// medalTier and label are derived from correctCount on read — not stored —
// so future threshold retuning takes effect retroactively without migrations.
export interface CategoryMedalStats {
  categoryId: number
  correctCount: number
  lastAnswerAt: FirebaseFirestore.Timestamp | null
  lastTierEarnedAt: FirebaseFirestore.Timestamp | null
}

// Returned from submitAnswer when an answer crosses a tier line. Client-safe.
// Preset-category medals carry a categoryId; custom-topic medals leave it
// null and supply customTopic. categoryName is whatever the UI should
// display ("Music", or the user's topic string).
export interface MedalEarned {
  tier: MedalTier
  label: string
  categoryId: number | null
  categoryName: string
  correctCount: number
  customTopic?: string
}

// --- Custom-topic medals -------------------------------------------------
//
// Infinite runs can be played against a user-supplied topic instead of a
// preset category. Those runs stamp their questions with `qData.category`
// equal to the raw topic string, which getCategoryIdByName() (correctly)
// won't resolve. We give those runs their own medal track keyed by topic.

// Stored at users/{uid}/triviaCustomCategoryStats/{slug}. The original
// topic string lives on the doc so callers don't have to round-trip the
// slug. Same threshold ladder as preset categories — only the labels and
// the keying differ.
export interface CustomCategoryMedalStats {
  topic: string
  correctCount: number
  lastAnswerAt: FirebaseFirestore.Timestamp | null
  lastTierEarnedAt: FirebaseFirestore.Timestamp | null
}

// Single shared ladder for every custom topic. Preset categories get
// bespoke honorifics; custom topics share this generic progression because
// the topic itself is the personalization.
export const CUSTOM_CATEGORY_MEDAL_LADDER: [string, string, string, string, string] = [
  'Curious',
  'Initiate',
  'Devotee',
  'Loremaster',
  'Oracle',
]

// Build a Firestore-safe doc id from a free-form topic. encodeURIComponent
// covers `/`, whitespace, and most punctuation; `.` is escaped explicitly
// because Firestore rejects ids of `.` / `..` and we want stable behavior
// for topics that contain dots. The encoding is reversible, so two
// distinct topics never collide on the same slug.
export function customCategorySlug(topic: string): string {
  return encodeURIComponent(topic).replaceAll('.', '%2E')
}

export function getCustomCategoryMedalLabel(tier: MedalTier): string | null {
  if (tier === 'none') return null
  const idx = TIER_ORDER.indexOf(tier)
  if (idx === -1) return null
  return CUSTOM_CATEGORY_MEDAL_LADDER[idx]
}

// Pure tier-up detection for custom-topic runs. Mirrors detectMedalEarned
// but pulls labels from the shared custom ladder.
export function detectCustomMedalEarned(
  prevCorrectCount: number,
  newCorrectCount: number
): { tier: MedalTier; label: string } | null {
  const prevTier = getMedalTier(prevCorrectCount)
  const newTier = getMedalTier(newCorrectCount)
  if (newTier === prevTier) return null
  if (newTier === 'none') return null
  const label = getCustomCategoryMedalLabel(newTier)
  if (!label) return null
  return { tier: newTier, label }
}
