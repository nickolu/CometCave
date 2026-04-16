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
