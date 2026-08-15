import { describe, expect, it } from 'vitest'

import {
  BAND_BRIEF,
  BAND_LABEL,
  BAND_MOVE,
  BAND_ORDER,
  HARD_MOVES,
  MAX_SITUATIONAL,
  MAX_SITUATIONAL_TOTAL,
  clampDc,
  clampSituational,
  difficultyLabel,
  netAdvantage,
  resolveCheck,
  rollD20,
} from '@/app/dicebound/domain/dice'

/** A d20 that always shows `value`, for testing the parts that aren't chance. */
function fixed(value: number) {
  return () => (value - 1) / 20 + 0.001
}

describe('rollD20', () => {
  it('covers exactly 1..20 across the unit interval', () => {
    expect(rollD20(() => 0)).toBe(1)
    expect(rollD20(() => 0.9999)).toBe(20)
    expect(rollD20(() => 0.5)).toBe(11)
  })

  it('never falls outside the die over many rolls', () => {
    for (let i = 0; i < 2000; i++) {
      const roll = rollD20()
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })
})

describe('clampDc', () => {
  it('holds the table bounds', () => {
    expect(clampDc(-5)).toBe(0)
    expect(clampDc(99)).toBe(30)
    expect(clampDc(12)).toBe(12)
  })

  it('falls back to medium for nonsense, rather than throwing', () => {
    expect(clampDc(undefined)).toBe(10)
    expect(clampDc('hard')).toBe(10)
    expect(clampDc(Number.NaN)).toBe(10)
  })
})

describe('difficultyLabel', () => {
  it('names exact rows', () => {
    expect(difficultyLabel(0)).toBe('trivial')
    expect(difficultyLabel(15)).toBe('hard')
    expect(difficultyLabel(30)).toBe('impossible')
  })

  it('rounds an off-table number down to the row below it', () => {
    expect(difficultyLabel(13)).toBe('kinda hard')
    expect(difficultyLabel(22)).toBe('extremely difficult')
  })
})

describe('clampSituational', () => {
  it('drops zeroes and clamps each entry', () => {
    const out = clampSituational([
      { label: 'wet floor', value: -9 },
      { label: 'nothing', value: 0 },
      { label: 'rope', value: 9 },
    ])
    expect(out).toEqual([
      { label: 'wet floor', value: -MAX_SITUATIONAL },
      { label: 'rope', value: MAX_SITUATIONAL },
    ])
  })

  it('scales a stacked set back under the total ceiling', () => {
    const out = clampSituational([
      { label: 'a', value: 4 },
      { label: 'b', value: 4 },
      { label: 'c', value: 4 },
    ])
    const total = out.reduce((sum, m) => sum + m.value, 0)
    expect(Math.abs(total)).toBeLessThanOrEqual(MAX_SITUATIONAL_TOTAL)
  })

  it('keeps every reason visible when it scales', () => {
    const out = clampSituational([
      { label: 'a', value: 4 },
      { label: 'b', value: 4 },
      { label: 'c', value: 4 },
    ])
    // The player was told three things affected this roll; all three still show.
    expect(out).toHaveLength(3)
    expect(out.every(m => m.value !== 0)).toBe(true)
  })
})

describe('resolveCheck', () => {
  it('adds the modifiers and reports the margin', () => {
    const outcome = resolveCheck(
      {
        dc: 15,
        modifiers: [
          { label: 'Dexterity', value: 2 },
          { label: 'rope', value: 1 },
        ],
      },
      fixed(12)
    )
    expect(outcome.roll).toBe(12)
    expect(outcome.modifier).toBe(3)
    expect(outcome.total).toBe(15)
    expect(outcome.margin).toBe(0)
    expect(outcome.succeeded).toBe(true)
  })

  it('keeps zero-value modifiers so the card can show its work', () => {
    const outcome = resolveCheck({ dc: 10, modifiers: [{ label: 'Wisdom', value: 0 }] }, fixed(10))
    expect(outcome.modifiers).toHaveLength(1)
  })

  it('bands by how far over or under the line it landed', () => {
    const dc = 10
    const mods = [{ label: 'x', value: 0 }]
    expect(resolveCheck({ dc, modifiers: mods }, fixed(16)).band).toBe('strong-success')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(12)).band).toBe('success')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(8)).band).toBe('failure')
    expect(resolveCheck({ dc, modifiers: mods }, fixed(4)).band).toBe('strong-failure')
  })

  it('lets a natural 20 beat a DC the character cannot reach', () => {
    const outcome = resolveCheck(
      { dc: 30, modifiers: [{ label: 'Strength', value: -2 }] },
      fixed(20)
    )
    expect(outcome.band).toBe('critical-success')
    expect(outcome.succeeded).toBe(true)
    // Still honest about the arithmetic — the card shows a miss by 12.
    expect(outcome.margin).toBe(-12)
  })

  it('lets a natural 1 fail a DC the character cannot miss', () => {
    const outcome = resolveCheck({ dc: 2, modifiers: [{ label: 'Strength', value: 3 }] }, fixed(1))
    expect(outcome.band).toBe('critical-failure')
    expect(outcome.succeeded).toBe(false)
    expect(outcome.margin).toBe(2)
  })
})

describe('the move list', () => {
  it('names a move for every band the dice can actually produce', () => {
    // The failure this protects against is silent: add a band, forget a move,
    // and the table in the prompt is simply missing a row for an outcome the
    // player can still roll.
    for (const band of BAND_ORDER) {
      expect(BAND_MOVE[band], `no move for ${band}`).toBeTruthy()
      expect(BAND_BRIEF[band], `no brief for ${band}`).toBeTruthy()
      expect(BAND_LABEL[band], `no label for ${band}`).toBeTruthy()
    }
  })

  it('orders every band exactly once, so the rendered table cannot skip or repeat one', () => {
    expect(BAND_ORDER).toHaveLength(Object.keys(BAND_MOVE).length)
    expect(new Set(BAND_ORDER).size).toBe(BAND_ORDER.length)
  })

  it('agrees with the brief about which bands succeeded and which did not', () => {
    // The acceptance criterion this exists for: the model is given BAND_BRIEF
    // and BAND_MOVE for the same roll, and if one says the attempt worked while
    // the other calls for a hard move, it splits the difference — always in the
    // player's favour. A success band must never be told to make a hard move.
    const succeeded = BAND_ORDER.filter(band => band.endsWith('success'))
    const failed = BAND_ORDER.filter(band => band.endsWith('failure'))

    for (const band of succeeded) {
      expect(BAND_MOVE[band].toLowerCase(), band).not.toContain('hard move')
    }
    for (const band of failed.filter(b => b !== 'failure')) {
      // 'failure' is the near miss and gets the soft move; the other two are hard.
      expect(BAND_MOVE[band].toLowerCase(), band).toContain('hard move')
    }
    expect(BAND_MOVE.failure.toLowerCase()).toContain('soft move')
  })

  it('gives the hard moves as concrete things to do, not adjectives', () => {
    expect(HARD_MOVES.length).toBeGreaterThan(3)
    for (const move of HARD_MOVES) {
      expect(move.endsWith('.'), move).toBe(true)
    }
  })
})

/** A d20 that shows each value in turn, so a two-die roll is exactly known. */
function sequence(...values: number[]) {
  let index = 0
  return () => {
    const value = values[Math.min(index++, values.length - 1)]
    return (value - 1) / 20 + 0.001
  }
}

describe('netAdvantage', () => {
  it('is nothing when nothing is pulling', () => {
    expect(netAdvantage([])).toBeNull()
  })

  it('advantage and disadvantage together are neither', () => {
    // Not a tally. Two advantages against one disadvantage is still neither,
    // because a flag that can be out-voted is a magnitude, and a magnitude is
    // the thing this is built to not be.
    expect(
      netAdvantage([
        { direction: 'advantage', reason: 'the fire is behind you' },
        { direction: 'advantage', reason: 'you have the high ground' },
        { direction: 'disadvantage', reason: 'your arm is broken' },
      ])
    ).toBeNull()
  })

  it('keeps every reason on the winning side, so the player is told all of them', () => {
    const net = netAdvantage([
      { direction: 'advantage', reason: 'the fire is behind you' },
      { direction: 'advantage', reason: 'you have the high ground' },
    ])
    expect(net?.direction).toBe('advantage')
    expect(net?.reason).toBe('the fire is behind you + you have the high ground')
  })
})

describe('resolveCheck with advantage', () => {
  it('advantage keeps the higher die and shows the one it threw away', () => {
    const outcome = resolveCheck(
      { dc: 10, modifiers: [], advantage: [{ direction: 'advantage', reason: 'the torch' }] },
      sequence(4, 17)
    )
    expect(outcome.roll).toBe(17)
    expect(outcome.twice).toEqual({ direction: 'advantage', reason: 'the torch', discarded: 4 })
  })

  it('disadvantage keeps the lower die', () => {
    const outcome = resolveCheck(
      { dc: 10, modifiers: [], advantage: [{ direction: 'disadvantage', reason: 'the dark' }] },
      sequence(4, 17)
    )
    expect(outcome.roll).toBe(4)
    expect(outcome.twice?.discarded).toBe(17)
  })

  it('a natural 1 on the kept die is still a critical failure', () => {
    // Decided on the kept die, never on either die thrown. Reading the naturals
    // off both would make advantage double a character's chance of a critical
    // failure, which is the reverse of what advantage is for.
    const outcome = resolveCheck(
      {
        dc: 5,
        modifiers: [{ label: 'Dexterity', value: 3 }],
        advantage: [{ direction: 'disadvantage', reason: 'the dark' }],
      },
      sequence(1, 20)
    )
    expect(outcome.roll).toBe(1)
    expect(outcome.band).toBe('critical-failure')
  })

  it('a natural 20 discarded is not a critical success', () => {
    const outcome = resolveCheck(
      { dc: 30, modifiers: [], advantage: [{ direction: 'disadvantage', reason: 'the dark' }] },
      sequence(20, 2)
    )
    expect(outcome.twice?.discarded).toBe(20)
    expect(outcome.band).not.toBe('critical-success')
  })

  it('advantage does not touch the situational budget', () => {
    // It moves the odds without moving a number, which is why it sits outside
    // the ±6 total and the +3 kit ceiling. Nothing about the arithmetic changes.
    const modifiers = [{ label: 'Dexterity', value: 2 }]
    const plain = resolveCheck({ dc: 10, modifiers }, sequence(11))
    const lucky = resolveCheck(
      { dc: 10, modifiers, advantage: [{ direction: 'advantage', reason: 'the torch' }] },
      sequence(11, 3)
    )
    expect(lucky.modifier).toBe(plain.modifier)
    expect(lucky.modifiers).toEqual(plain.modifiers)
    expect(lucky.total).toBe(plain.total)
  })

  it('throws one die when nothing is pulling, so an ordinary check is unchanged', () => {
    // The second value in the sequence must never be reached. If it were, every
    // seeded test in this file would silently start rolling something else.
    const outcome = resolveCheck({ dc: 10, modifiers: [], advantage: [] }, sequence(11, 20))
    expect(outcome.roll).toBe(11)
    expect(outcome.twice).toBeNull()
  })

  it('cancelled sources throw one die, not two', () => {
    const outcome = resolveCheck(
      {
        dc: 10,
        modifiers: [],
        advantage: [
          { direction: 'advantage', reason: 'the torch' },
          { direction: 'disadvantage', reason: 'the dark' },
        ],
      },
      sequence(11, 20)
    )
    expect(outcome.roll).toBe(11)
    expect(outcome.twice).toBeNull()
  })
})
