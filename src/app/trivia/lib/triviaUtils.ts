import { format } from 'date-fns'

// Get current date string in PST (YYYY-MM-DD)
export function getTodayPST(): string {
  const now = new Date()
  const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const pstDate = new Date(pstString)
  return format(pstDate, 'yyyy-MM-dd')
}

// Check if user has already played today
export function hasPlayedToday(lastPlayedDate: string | null): boolean {
  if (!lastPlayedDate) return false
  return lastPlayedDate === getTodayPST()
}

// Format date for display (e.g., "April 16, 2026")
export function formatDisplayDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Category rotation — same formula as the question generator
// Category ID cycles through 9-32 (24 OpenTDB categories) once per 24 days
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

// Given a PST date string (YYYY-MM-DD), return today's category theme
export function getDailyCategory(dateStr?: string): DailyCategory {
  const date = dateStr ?? getTodayPST()
  const days = daysSinceEpoch(date)
  const id = 9 + (days % 24)
  const meta = CATEGORY_META[id] ?? CATEGORY_META[9]
  return { id, name: meta.name, icon: meta.icon }
}
