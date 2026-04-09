import { describe, expect, it } from 'vitest'

import { buildStoryContext } from '@/app/fantasy-tycoon/lib/contextBuilder'
import { FantasyCharacter } from '@/app/fantasy-tycoon/models/character'
import { FantasyStoryEvent } from '@/app/fantasy-tycoon/models/story'

const baseChar: FantasyCharacter = {
  id: 'char-1',
  playerId: 'p1',
  name: 'Elara',
  race: 'Elf',
  class: 'Mage',
  level: 3,
  xp: 50,
  xpToNextLevel: 225,
  abilities: [],
  locationId: 'loc1',
  gold: 100,
  reputation: 25,
  distance: 15,
  status: 'active',
  strength: 7,
  intelligence: 10,
  luck: 6,
  inventory: [
    { id: 'item-1', name: 'Healing Potion', description: 'Heals', quantity: 2 },
  ],
}

function makeEvent(overrides: Partial<FantasyStoryEvent> = {}): FantasyStoryEvent {
  return {
    id: 'evt-1',
    type: 'decision_result',
    characterId: 'char-1',
    locationId: 'loc1',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('buildStoryContext', () => {
  it('returns character summary with empty events', () => {
    const context = buildStoryContext(baseChar, [])
    expect(context).toContain('Elara')
    expect(context).toContain('Level 3')
    expect(context).toContain('Elf Mage')
    expect(context).toContain('Gold: 100')
    expect(context).toContain('STR 7')
  })

  it('includes inventory highlights', () => {
    const context = buildStoryContext(baseChar, [])
    expect(context).toContain('Healing Potion')
  })

  it('includes recent event details', () => {
    const events = [
      makeEvent({
        selectedOptionText: 'Fight the dragon',
        outcomeDescription: 'You defeated the dragon!',
        decisionPoint: {
          id: 'dp-1',
          eventId: 'evt-1',
          prompt: 'A dragon blocks your path.',
          options: [],
          resolved: true,
        },
      }),
    ]
    const context = buildStoryContext(baseChar, events)
    expect(context).toContain('A dragon blocks your path')
    expect(context).toContain('Fight the dragon')
    expect(context).toContain('defeated the dragon')
  })

  it('filters events by character ID', () => {
    const events = [
      makeEvent({ characterId: 'char-1', outcomeDescription: 'Relevant event' }),
      makeEvent({ id: 'evt-2', characterId: 'other-char', outcomeDescription: 'Irrelevant event' }),
    ]
    const context = buildStoryContext(baseChar, events)
    expect(context).toContain('Relevant event')
    expect(context).not.toContain('Irrelevant event')
  })

  it('respects maxEvents limit', () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        outcomeDescription: `Event number ${i}`,
      })
    )
    const context = buildStoryContext(baseChar, events, 3)
    // Should only include last 3 events
    expect(context).toContain('Event number 17')
    expect(context).toContain('Event number 18')
    expect(context).toContain('Event number 19')
    expect(context).not.toContain('Event number 0')
  })

  it('caps context string length', () => {
    const longEvents = Array.from({ length: 50 }, (_, i) =>
      makeEvent({
        id: `evt-${i}`,
        outcomeDescription: 'A very long outcome description that contains lots of words to test the length cap',
        selectedOptionText: 'A very long selected option text',
        decisionPoint: {
          id: `dp-${i}`,
          eventId: `evt-${i}`,
          prompt: 'A very long prompt that adds to the total context length',
          options: [],
          resolved: true,
        },
      })
    )
    const context = buildStoryContext(baseChar, longEvents)
    expect(context.length).toBeLessThanOrEqual(1500)
  })
})
