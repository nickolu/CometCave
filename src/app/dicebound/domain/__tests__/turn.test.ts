import { describe, expect, it } from 'vitest'

import {
  NARRATE_TOOL,
  ROLL_CHECK_TOOL,
  type ToolCall,
  partitionTurnCalls,
} from '@/app/dicebound/domain/turn'

const roll = (id: string): ToolCall & { id: string } => ({
  id,
  name: ROLL_CHECK_TOOL,
  input: { dc: 15 },
})

const narrate = (id: string, text = 'You push the door.'): ToolCall & { id: string } => ({
  id,
  name: NARRATE_TOOL,
  input: { text },
})

describe('partitionTurnCalls', () => {
  it('ends the turn when the only call is narrate', () => {
    const { rolls, ending, premature } = partitionTurnCalls([narrate('a')])

    expect(rolls).toEqual([])
    expect(ending?.id).toBe('a')
    expect(premature).toEqual([])
  })

  it('keeps the turn open when the model asks for a roll', () => {
    const { rolls, ending } = partitionTurnCalls([roll('a')])

    expect(rolls.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
  })

  it('discards narration sent in the same breath as a roll — it was written before the die', () => {
    // The whole point of roll_check is that the model commits to a difficulty
    // before it learns the number. Narration composed alongside the roll cannot
    // be about the result, so honouring it would resolve the turn without the
    // dice.
    const { rolls, ending, premature } = partitionTurnCalls([roll('a'), narrate('b')])

    expect(rolls.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
    expect(premature.map(c => c.id)).toEqual(['b'])
  })

  it('still answers the discarded narration, because the wire demands a result for every call', () => {
    const { premature } = partitionTurnCalls([narrate('b'), roll('a')])

    // Dropping it silently would send an assistant turn with a tool_use block
    // that has no matching tool_result, which the API rejects outright.
    expect(premature.map(c => c.id)).toEqual(['b'])
  })

  it('resolves every roll in a multi-roll pass, in the order they arrived', () => {
    const { rolls } = partitionTurnCalls([roll('a'), roll('b'), roll('c')])

    expect(rolls.map(c => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('takes only the first of two narrations — the second is a duplicate, not a continuation', () => {
    const { ending, premature } = partitionTurnCalls([narrate('a'), narrate('b')])

    expect(ending?.id).toBe('a')
    expect(premature.map(c => c.id)).toEqual(['b'])
  })

  it('reports nothing to do when the model called no tools at all', () => {
    const { rolls, ending, premature } = partitionTurnCalls([])

    expect(rolls).toEqual([])
    expect(ending).toBeNull()
    expect(premature).toEqual([])
  })

  it('ignores a tool the loop does not know about rather than mistaking it for an ending', () => {
    const { rolls, ending, premature } = partitionTurnCalls([{ name: 'recall', input: {} }])

    expect(rolls).toEqual([])
    expect(ending).toBeNull()
    expect(premature).toEqual([])
  })
})
