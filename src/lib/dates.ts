import { format } from 'date-fns'

export function getTodayPST(): string {
  const now = new Date()
  const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const pstDate = new Date(pstString)
  return format(pstDate, 'yyyy-MM-dd')
}

export function hasPlayedToday(lastPlayedDate: string | null): boolean {
  if (!lastPlayedDate) return false
  return lastPlayedDate === getTodayPST()
}

export function formatDisplayDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00-08:00')
  const year = d.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((days + jan1.getUTCDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const today = new Date(pstStr)

  const dayOfWeek = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek - 1))

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return { start: fmt(monday), end: fmt(sunday) }
}
