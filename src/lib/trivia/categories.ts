import { getTodayPST } from '@/lib/dates'

export const CATEGORY_META: Record<number, { name: string; icon: string }> = {
  9: { name: 'General Knowledge', icon: '🧠' },
  10: { name: 'Books', icon: '📚' },
  11: { name: 'Film', icon: '🎬' },
  12: { name: 'Music', icon: '🎵' },
  13: { name: 'Musicals & Theatre', icon: '🎭' },
  14: { name: 'Television', icon: '📺' },
  15: { name: 'Video Games', icon: '🎮' },
  16: { name: 'Board Games', icon: '🎲' },
  17: { name: 'Science & Nature', icon: '🌿' },
  18: { name: 'Computers', icon: '💻' },
  19: { name: 'Mathematics', icon: '🔢' },
  20: { name: 'Mythology', icon: '🐉' },
  21: { name: 'Sports', icon: '⚽' },
  22: { name: 'Geography', icon: '🌍' },
  23: { name: 'History', icon: '📜' },
  24: { name: 'Politics', icon: '🏛️' },
  25: { name: 'Art', icon: '🎨' },
  26: { name: 'Celebrities', icon: '⭐' },
  27: { name: 'Animals', icon: '🐾' },
  28: { name: 'Vehicles', icon: '🚗' },
  29: { name: 'Comics', icon: '💥' },
  30: { name: 'Gadgets', icon: '📱' },
  31: { name: 'Anime & Manga', icon: '🎌' },
  32: { name: 'Cartoons & Animation', icon: '✏️' },
}

function daysSinceEpoch(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00-08:00')
  return Math.floor(d.getTime() / 86400000)
}

export interface DailyCategory {
  id: number
  name: string
  icon: string
}

export function getDailyCategory(dateStr?: string): DailyCategory {
  const date = dateStr ?? getTodayPST()
  const days = daysSinceEpoch(date)
  const id = 9 + (days % 24)
  const meta = CATEGORY_META[id] ?? CATEGORY_META[9]
  return { id, name: meta.name, icon: meta.icon }
}

// Questions store their category as the OpenTDB-prefixed name returned by
// getOpenTDBCategoryName() in src/app/trivia/data/seeds/categoryNames.ts
// (e.g. "Entertainment: Books", "Science: Computers"), not the bare
// CATEGORY_META name. This map covers both forms so medal tracking matches
// either spelling — including the OpenTDB pluralization quirks
// ("Theatres", "Cartoon & Animations") that don't match CATEGORY_META.
const CATEGORY_NAME_TO_ID: ReadonlyMap<string, number> = new Map<string, number>([
  ...Object.entries(CATEGORY_META).map(([id, meta]) => [meta.name, Number(id)] as const),
  ['Entertainment: Books', 10],
  ['Entertainment: Film', 11],
  ['Entertainment: Music', 12],
  ['Entertainment: Musicals & Theatres', 13],
  ['Entertainment: Television', 14],
  ['Entertainment: Video Games', 15],
  ['Entertainment: Board Games', 16],
  ['Science: Computers', 18],
  ['Science: Mathematics', 19],
  ['Entertainment: Comics', 29],
  ['Science: Gadgets', 30],
  ['Entertainment: Japanese Anime & Manga', 31],
  ['Entertainment: Cartoon & Animations', 32],
])

// Reverse lookup for the question.category string stored on aiQuestions docs.
// Returns null when the name doesn't match a known category (e.g. a custom
// free-form topic from an infinite run with customCategory set).
export function getCategoryIdByName(name: string): number | null {
  return CATEGORY_NAME_TO_ID.get(name) ?? null
}
