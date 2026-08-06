export interface SpeedRunRecord {
  theme: string
  targetGen: number
  seconds: number
  date: string
}

const KEY = 'micro-land:speed-run:records:v1'
const MAX_PER_TARGET = 10

function loadAll(): Record<string, SpeedRunRecord[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, SpeedRunRecord[]>
  } catch {
    return {}
  }
}

export function loadSpeedRunRecords(targetGen: number): SpeedRunRecord[] {
  return loadAll()[String(targetGen)] ?? []
}

export function saveSpeedRunRecord(record: SpeedRunRecord): void {
  try {
    const all = loadAll()
    const key = String(record.targetGen)
    const existing = all[key] ?? []
    const updated = [...existing, record]
      .sort((a, b) => a.seconds - b.seconds)
      .slice(0, MAX_PER_TARGET)
    all[key] = updated
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Private-mode Safari or storage full — silently skip
  }
}
