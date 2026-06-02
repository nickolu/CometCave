import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'

export function getCopyJokerDescription(jokerId: string, index: number, allJokers: JokerState[]): string | undefined {
  if (jokerId === 'blueprint') {
    const rightJoker = allJokers[index + 1]
    if (!rightJoker) return 'Copies ability of Joker to the right (no joker to copy)'
    const rightDef = jokers[rightJoker.jokerId]
    return `Copies ability of Joker to the right (currently: ${rightDef?.name ?? 'Unknown'})`
  }
  if (jokerId === 'brainstorm') {
    const leftmostJoker = allJokers[0]
    if (!leftmostJoker || leftmostJoker.jokerId === 'brainstorm') {
      return 'Copies the ability of leftmost Joker (no joker to copy)'
    }
    const leftDef = jokers[leftmostJoker.jokerId]
    return `Copies the ability of leftmost Joker (currently: ${leftDef?.name ?? 'Unknown'})`
  }
  return undefined
}
