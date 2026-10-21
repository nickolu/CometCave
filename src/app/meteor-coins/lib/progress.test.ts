import { emptyProgress, isUnlocked, nextStageAfter, parseProgress, recordResult } from './progress'
import { STAGES, findStage } from './stages'

const stage = (n: number) => STAGES[n - 1]

describe('parseProgress', () => {
  it('starts empty with nothing stored or something unreadable', () => {
    expect(parseProgress(null)).toEqual(emptyProgress())
    expect(parseProgress('not json')).toEqual(emptyProgress())
    expect(parseProgress('[1,2]')).toEqual(emptyProgress())
  })

  it('keeps valid entries and drops tampered ones', () => {
    const raw = JSON.stringify({
      stars: { 'penny-falls': 2, 'moonstone-porch': 7, 'not-a-stage': 3 },
      best: { 'penny-falls': 64.9, 'moonstone-porch': -4, 'the-cairn': 'lots' },
    })
    expect(parseProgress(raw)).toEqual({ stars: { 'penny-falls': 2 }, best: { 'penny-falls': 64 } })
  })
})

describe('recordResult', () => {
  it('keeps the better result of the two', () => {
    let p = recordResult(emptyProgress(), 'penny-falls', 60, 2)
    p = recordResult(p, 'penny-falls', 30, 1)
    expect(p).toEqual({ stars: { 'penny-falls': 2 }, best: { 'penny-falls': 60 } })
    p = recordResult(p, 'penny-falls', 95, 3)
    expect(p).toEqual({ stars: { 'penny-falls': 3 }, best: { 'penny-falls': 95 } })
  })

  it('keeps the stars but no best when there is nothing to compare', () => {
    const p = recordResult(emptyProgress(), 'brambles-midnight-snack', null, 0)
    expect(p).toEqual({ stars: { 'brambles-midnight-snack': 0 }, best: {} })
  })
})

describe('unlocking', () => {
  it('opens stage 1 for everyone', () => {
    expect(isUnlocked(emptyProgress(), stage(1))).toBe(true)
  })

  it('opens each stage once the one before has a star', () => {
    const none = recordResult(emptyProgress(), 'penny-falls', 10, 0)
    expect(isUnlocked(none, stage(2))).toBe(false)
    const one = recordResult(none, 'penny-falls', 30, 1)
    expect(isUnlocked(one, stage(2))).toBe(true)
    expect(isUnlocked(one, stage(3))).toBe(false)
  })
})

describe('stages', () => {
  it('numbers twelve stages in order with unique slugs', () => {
    expect(STAGES.map(s => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(new Set(STAGES.map(s => s.slug)).size).toBe(12)
  })

  it('finds a stage by slug or number', () => {
    expect(findStage('penny-falls')?.number).toBe(1)
    expect(findStage('1')?.slug).toBe('penny-falls')
    expect(findStage('nope')).toBeUndefined()
  })

  it('points to the next stage', () => {
    expect(nextStageAfter(stage(1))?.number).toBe(2)
    expect(nextStageAfter(stage(12))).toBeUndefined()
  })
})
