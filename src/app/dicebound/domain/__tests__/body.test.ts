/**
 * The condition track.
 *
 * Nearly every test here is a property asserted exhaustively rather than a
 * hand-picked case, because `STEPS` is thirty-six numbers written out by hand
 * and the interesting failure is a typo in one of them — `grievous` costing less
 * than `bloody` at one danger setting and one band would never show up in a
 * spot check, and would quietly make a whole row of the table meaningless.
 */
import { describe, expect, it } from 'vitest'

import {
  CONDITION_LABEL,
  CONDITION_ORDER,
  CONDITION_PHRASE,
  type Condition,
  DAMAGE_TABLE,
  DANGER_ORDER,
  DEFAULT_DANGER,
  SEVERITY_ORDER,
  TRACK_LENGTH,
  applyDamage,
  conditionIndex,
  damageFor,
  damageRow,
  isDead,
  undamagedBody,
  validateBody,
  validateDanger,
  validateSeverity,
  worsen,
} from '@/app/dicebound/domain/body'
import { BAND_ORDER } from '@/app/dicebound/domain/dice'
import type { OutcomeBand } from '@/app/dicebound/domain/dice'

const SUCCESSES: readonly OutcomeBand[] = ['critical-success', 'strong-success', 'success']
const FAILURES: readonly OutcomeBand[] = ['failure', 'strong-failure', 'critical-failure']

describe('the track', () => {
  it('runs best to worst and ends in death', () => {
    expect(CONDITION_ORDER[0]).toBe('unhurt')
    expect(CONDITION_ORDER[CONDITION_ORDER.length - 1]).toBe('dead')
    expect(TRACK_LENGTH).toBe(CONDITION_ORDER.length - 1)
  })

  it('gives every rung a word for the sheet and a phrase for the dungeon master', () => {
    // A rung with no phrase is a rung the DM narrates from nothing, which is how
    // the prose starts disagreeing with the sheet.
    for (const condition of CONDITION_ORDER) {
      expect(CONDITION_LABEL[condition]).toBeTruthy()
      expect(CONDITION_PHRASE[condition].length).toBeGreaterThan(20)
    }
  })

  it('indexes rungs in order, and reads an unknown one as unhurt', () => {
    CONDITION_ORDER.forEach((condition, index) => {
      expect(conditionIndex(condition)).toBe(index)
    })
    expect(conditionIndex('sprained' as Condition)).toBe(0)
  })

  it('starts a character unhurt and not dead', () => {
    expect(undamagedBody().condition).toBe('unhurt')
    expect(isDead(undamagedBody())).toBe(false)
    expect(isDead({ condition: 'dying' })).toBe(false)
    expect(isDead({ condition: 'dead' })).toBe(true)
  })
})

describe('the severity table', () => {
  it('anchors every row with a concrete example, because that is the safety mechanism', () => {
    // The risk this table exists to manage is the DM assigning `lethal` to
    // something the fiction never signalled was lethal. An unanchored row is a
    // row the model picks on vibes.
    for (const severity of SEVERITY_ORDER) {
      const row = damageRow(severity)
      expect(row.severity).toBe(severity)
      expect(row.example.length).toBeGreaterThan(30)
    }
    expect(DAMAGE_TABLE).toHaveLength(SEVERITY_ORDER.length)
  })

  it('warns in the lethal row itself that the player must have been able to see it coming', () => {
    expect(damageRow('lethal').example).toMatch(/could not have known|already told them/)
  })

  it('reads an unrecognised severity off a tool call as the mildest one', () => {
    // The model writes this field. Repairing upward would let a typo kill
    // someone; repairing downward costs at worst a wound that did not land.
    expect(validateSeverity('devastating')).toBe('bruising')
    expect(validateSeverity(undefined)).toBe('bruising')
    expect(validateSeverity('grievous')).toBe('grievous')
  })
})

describe('damageFor', () => {
  it('costs nothing on a success, at every severity and every danger', () => {
    // You made the check. Charging for it would punish people for winning and
    // make refusing to roll the safest play.
    for (const danger of DANGER_ORDER) {
      for (const severity of SEVERITY_ORDER) {
        for (const band of SUCCESSES) {
          expect(damageFor(severity, band, danger)).toBe(0)
        }
      }
    }
  })

  it('never costs less for a worse band', () => {
    for (const danger of DANGER_ORDER) {
      for (const severity of SEVERITY_ORDER) {
        const steps = FAILURES.map(band => damageFor(severity, band, danger))
        expect(steps).toEqual([...steps].sort((a, b) => a - b))
      }
    }
  })

  it('never costs less for a worse severity', () => {
    for (const danger of DANGER_ORDER) {
      for (const band of FAILURES) {
        const steps = SEVERITY_ORDER.map(severity => damageFor(severity, band, danger))
        expect(steps).toEqual([...steps].sort((a, b) => a - b))
      }
    }
  })

  it('never costs less in a more dangerous world — perilous ≥ ordinary ≥ gentle', () => {
    // The dial is the reason this parameter exists (#3777). Three rows that do
    // not actually differ in the right direction are three rows of nothing.
    for (const severity of SEVERITY_ORDER) {
      for (const band of FAILURES) {
        const steps = DANGER_ORDER.map(danger => damageFor(severity, band, danger))
        expect(steps).toEqual([...steps].sort((a, b) => a - b))
      }
    }
  })

  it('defaults to the middle setting, so a caller with no dial gets the tuned table', () => {
    for (const severity of SEVERITY_ORDER) {
      for (const band of BAND_ORDER) {
        expect(damageFor(severity, band)).toBe(damageFor(severity, band, DEFAULT_DANGER))
      }
    }
    expect(DEFAULT_DANGER).toBe('ordinary')
  })

  it('lets an ordinary near miss with nothing sharp in it cost nothing at all', () => {
    // Most failed checks are not injuries. A track that ticked on every miss
    // would walk a talkative character to death through a series of arguments.
    expect(damageFor('bruising', 'failure', 'ordinary')).toBe(0)
  })
})

describe('what bruising can never do', () => {
  it('cannot kill, from any rung, on any band, at any danger setting', () => {
    // This is the difference between a tense game and one where people stop
    // playing: a character on the ground finished by a scraped elbow reads as
    // an accident rather than an ending.
    for (const danger of DANGER_ORDER) {
      for (const band of BAND_ORDER) {
        for (const from of CONDITION_ORDER) {
          if (from === 'dead') continue
          expect(applyDamage({ condition: from }, 'bruising', band, danger).to).not.toBe('dead')
        }
      }
    }
  })

  it('still cannot kill at perilous, where every other row got worse', () => {
    expect(applyDamage({ condition: 'dying' }, 'bruising', 'critical-failure', 'perilous').to).toBe(
      'dying'
    )
  })

  it('carries the rule on the row rather than somewhere the next severity would miss it', () => {
    expect(damageRow('bruising').fatal).toBe(false)
    expect(SEVERITY_ORDER.filter(s => !damageRow(s).fatal)).toEqual(['bruising'])
  })
})

describe('lethal', () => {
  it('ends a healthy character on a natural 1 — and that is intended', () => {
    // It needs two things at once: a scene the fiction already flagged as
    // deadly, and a critical failure. If that could not kill, nothing in this
    // game could ever kill you on the day it happened.
    const change = applyDamage(undamagedBody(), 'lethal', 'critical-failure', 'ordinary')
    expect(change.to).toBe('dead')
    expect(change.died).toBe(true)
    expect(change.steps).toBe(TRACK_LENGTH)
  })

  it('leaves a healthy character alive at gentle, where death has to be walked into', () => {
    const change = applyDamage(undamagedBody(), 'lethal', 'critical-failure', 'gentle')
    expect(change.to).not.toBe('dead')
    expect(change.to).toBe('broken')
  })

  it('does not spare a character who was already dying', () => {
    expect(applyDamage({ condition: 'dying' }, 'lethal', 'failure', 'ordinary').to).toBe('dead')
  })
})

describe('worsen', () => {
  it('does nothing when the blow cost nothing', () => {
    expect(worsen('hurt', 0, true)).toBe('hurt')
    expect(worsen('hurt', -2, true)).toBe('hurt')
  })

  it('never moves a body back up the track', () => {
    // A non-fatal blow floors at `dying`, and a body already there stays there
    // rather than being pulled up to it.
    expect(worsen('dying', 3, false)).toBe('dying')
    expect(worsen('dead', 3, false)).toBe('dead')
  })

  it('leaves the dead where they are, whatever hits them next', () => {
    expect(worsen('dead', 6, true)).toBe('dead')
  })

  it('stops at the end of the track rather than running off it', () => {
    expect(worsen('broken', 99, true)).toBe('dead')
    expect(worsen('broken', 99, false)).toBe('dying')
  })

  it('leaves dying reachable and survivable, so the last step is a moment not a switch', () => {
    // `dying` is a rung. Nothing here marks it terminal, which is what lets a
    // later healing pass climb back out of it.
    expect(worsen('broken', 1, true)).toBe('dying')
    expect(worsen('dying', 0, true)).toBe('dying')
  })
})

describe('applyDamage', () => {
  it('reports what actually happened, not what the table asked for', () => {
    // The DM being told a wound cost three rungs when the floor let it cost one
    // is how prose starts disagreeing with the sheet.
    const change = applyDamage({ condition: 'broken' }, 'bruising', 'critical-failure', 'perilous')
    expect(damageFor('bruising', 'critical-failure', 'perilous')).toBe(2)
    expect(change.from).toBe('broken')
    expect(change.to).toBe('dying')
    expect(change.steps).toBe(1)
    expect(change.died).toBe(false)
  })

  it('leaves the body object untouched when nothing moved', () => {
    const body = undamagedBody()
    const change = applyDamage(body, 'bruising', 'success')
    expect(change.body).toBe(body)
    expect(change.steps).toBe(0)
  })

  it('does not report a second death for a body that was already dead', () => {
    const change = applyDamage({ condition: 'dead' }, 'lethal', 'critical-failure')
    expect(change.died).toBe(false)
    expect(change.steps).toBe(0)
  })
})

describe('reading a body off the wire', () => {
  it('reads a body full of garbage as undamaged rather than throwing', () => {
    // Losing the index must never cost the player the story, and it must
    // certainly never cost them a character.
    expect(validateBody(undefined).condition).toBe('unhurt')
    expect(validateBody(null).condition).toBe('unhurt')
    expect(validateBody('dead').condition).toBe('unhurt')
    expect(validateBody([]).condition).toBe('unhurt')
    expect(validateBody({ condition: 42 }).condition).toBe('unhurt')
    expect(validateBody({ condition: 'sprained' }).condition).toBe('unhurt')
  })

  it('keeps a condition it recognises', () => {
    for (const condition of CONDITION_ORDER) {
      expect(validateBody({ condition }).condition).toBe(condition)
    }
  })

  it('reads a missing danger dial as ordinary', () => {
    expect(validateDanger(undefined)).toBe(DEFAULT_DANGER)
    expect(validateDanger('reckless')).toBe(DEFAULT_DANGER)
    expect(validateDanger('gentle')).toBe('gentle')
  })
})
