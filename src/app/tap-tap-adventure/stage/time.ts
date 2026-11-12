import { STEPS_PER_DAY } from '@/app/tap-tap-adventure/lib/leveling'

export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'nightfall'

export function getTimeOfDay(distance: number): TimeOfDay {
  const stepInDay = distance % STEPS_PER_DAY
  const fraction = stepInDay / STEPS_PER_DAY
  if (fraction < 0.25) return 'morning'
  if (fraction < 0.5) return 'midday'
  if (fraction < 0.75) return 'afternoon'
  return 'nightfall'
}

export const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  nightfall: 'Nightfall',
}
