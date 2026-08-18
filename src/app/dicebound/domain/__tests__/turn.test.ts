import { describe, expect, it } from 'vitest'

import {
  GRANT_POWER_TOOL,
  HARM_TOOL,
  NARRATE_TOOL,
  RECALL_TOOL,
  ROLL_CHECK_TOOL,
  type ToolCall,
  USE_POWER_TOOL,
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

describe('recall in the turn loop', () => {
  const recall = (id: string): ToolCall & { id: string } => ({
    id,
    name: RECALL_TOOL,
    input: { query: 'the man from the harbour' },
  })

  it('answers a lookup without ending the turn — checking your notes is not a move', () => {
    const { recalls, ending } = partitionTurnCalls([recall('a')])

    expect(recalls.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
  })

  it('discards narration written alongside a lookup, for the same reason as a roll', () => {
    // Whatever the DM asked to remember cannot be in prose it wrote before the
    // answer came back.
    const { recalls, ending, premature } = partitionTurnCalls([recall('a'), narrate('b')])

    expect(recalls.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
    expect(premature.map(c => c.id)).toEqual(['b'])
  })

  it('still lets a plain narration end the turn', () => {
    const { recalls, ending } = partitionTurnCalls([narrate('a')])
    expect(recalls).toEqual([])
    expect(ending?.id).toBe('a')
  })
})

const grantPower = (id: string): ToolCall & { id: string } => ({
  id,
  name: GRANT_POWER_TOOL,
  input: { id: 'ember-hand', source: 'maren' },
})

describe('partitionTurnCalls and grant_power', () => {
  it('does not end the turn, so the DM narrates after learning what it got', () => {
    const { powerGrants, ending } = partitionTurnCalls([grantPower('a')])

    expect(powerGrants.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
  })

  it('discards narration sent beside a power grant — the grant can be refused', () => {
    // Sharper than the roll case. A grant may come back "they are not far
    // enough along for that", and narration composed in the same breath
    // describes a character learning something they did not get.
    const { powerGrants, ending, premature } = partitionTurnCalls([
      grantPower('a'),
      narrate('b', 'Maren presses the ember into your palm and it takes.'),
    ])

    expect(powerGrants.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
    expect(premature.map(c => c.id)).toEqual(['b'])
  })
})

const usePowerCall = (id: string): ToolCall & { id: string } => ({
  id,
  name: USE_POWER_TOOL,
  input: { id: 'ember-hand' },
})

describe('partitionTurnCalls and use_power', () => {
  it('does not end the turn — the DM has to be told what the power made available', () => {
    const { powerUses, ending } = partitionTurnCalls([usePowerCall('a')])

    expect(powerUses.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
  })

  it('discards narration written in the same breath as spending a power', () => {
    // Invariant 2 again. That narration was composed before the power's effect
    // existed — before the model knew whether the charge was even there.
    const { powerUses, ending, premature } = partitionTurnCalls([
      usePowerCall('a'),
      narrate('b', 'Fire blooms in your palm and the guard goes down.'),
    ])

    expect(powerUses.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
    expect(premature.map(c => c.id)).toEqual(['b'])
  })
})

const harmCall = (id: string): ToolCall & { id: string } => ({
  id,
  name: HARM_TOOL,
  input: { severity: 'bloody', reason: 'the beam comes down' },
})

describe('partitionTurnCalls and harm', () => {
  it('does not end the turn — a player owed an ambush is owed the narration of it', () => {
    const { harms, ending } = partitionTurnCalls([harmCall('a')])

    expect(harms.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
  })

  it('discards narration written in the same breath as the harm', () => {
    // Invariant 2, and the same reason as the die. The model named a severity;
    // the game decides what that severity costs, and it may cost nothing at
    // all. Narration composed beside it describes a wound whose weight had not
    // been assigned yet — and the model's guess at that weight is exactly what
    // this tool exists to take away from it.
    const { harms, ending, premature } = partitionTurnCalls([
      harmCall('a'),
      narrate('b', 'The beam takes your leg and you will not walk again.'),
    ])

    expect(harms.map(c => c.id)).toEqual(['a'])
    expect(ending).toBeNull()
    expect(premature.map(c => c.id)).toEqual(['b'])
  })

  it('carries a harm sent alongside a roll, so the loop can order them itself', () => {
    const { rolls, harms, ending } = partitionTurnCalls([roll('a'), harmCall('b')])

    expect(rolls.map(c => c.id)).toEqual(['a'])
    expect(harms.map(c => c.id)).toEqual(['b'])
    expect(ending).toBeNull()
  })
})
