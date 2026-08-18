/**
 * The body's trip through a finished turn.
 *
 * `rollFor` — where severity actually becomes damage — lives in the route and
 * has no test harness; the epic's answer to that is a real turn, not a mock.
 * What is testable here is the rule that makes the wound stick, and it is the
 * one that has already been got wrong twice for `world` and `kit`: a field the
 * turn did not set must read as *unchanged*, never as reset.
 */
import { describe, expect, it } from 'vitest'

import { newCampaign } from '@/app/dicebound/domain/campaign'
import { blankAttributes } from '@/app/dicebound/domain/character'
import { applyTurn } from '@/app/dicebound/domain/turn'

function campaign() {
  return newCampaign(
    'a lighthouse that has started walking',
    {
      name: 'Pell',
      concept: 'a very small person with a very large hammer',
      reading: '',
      attributes: blankAttributes(),
      skills: {},
    },
    1000,
    null
  )
}

describe('the body across a turn', () => {
  it('keeps the wound the turn inflicted', () => {
    const after = applyTurn(campaign(), { entries: [], body: { condition: 'bloodied' } }, 2000)
    expect(after.body.condition).toBe('bloodied')
  })

  it('leaves the body alone on a turn that never touched it — absent means unchanged, not healed', () => {
    // A missing field read as an undamaged body would make every quiet turn a
    // free heal. The player would never see it happen; they would only notice
    // that nothing that is done to them ever seems to stay done.
    const hurt = { ...campaign(), body: { condition: 'broken' as const } }
    expect(applyTurn(hurt, { entries: [] }, 2000).body.condition).toBe('broken')
  })

  it('does not let a turn that ended without narrating undo a wound it already landed', () => {
    // Three rolls in one turn land on each other, so the body is carried
    // through the loop rather than written back per roll — and the fallback
    // paths out of the loop have to carry it too.
    const hurt = { ...campaign(), body: { condition: 'hurt' as const } }
    const after = applyTurn(hurt, { entries: [], body: { condition: 'dying' } }, 2000)
    expect(after.body.condition).toBe('dying')
  })
})
