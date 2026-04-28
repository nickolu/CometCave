import { getTodayPST } from '@/lib/dates'

const CATEGORY_META: Record<number, { name: string; icon: string }> = {
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
