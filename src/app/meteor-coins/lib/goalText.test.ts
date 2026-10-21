import { headline, hudMeasure, hudStars, nextStarSentence } from './goalText'
import { drop, fall, initialState } from './rules'
import { type StageDef, playableStage } from './stages'

const PENNY = playableStage('penny-falls') as StageDef
const PORCH = playableStage('moonstone-porch') as StageDef
const BRAMBLE = playableStage('brambles-midnight-snack') as StageDef
const MOONSTONE = { id: 'moonstone', points: 1, refund: 3 }

describe('goal text', () => {
  it('reads a score goal as points', () => {
    const s = { ...initialState(PENNY.rules), score: 30 }
    expect(hudMeasure(PENNY, s)).toEqual({ label: 'Score', value: '30' })
    expect(hudStars(PENNY, s).note).toBe('next at 50')
    expect(nextStarSentence(PENNY, s)).toBe('50 coins into the chute for 2 stars.')
  })

  it('reads a collect goal as a count out of the total', () => {
    let s = drop(initialState(PORCH.rules))
    s = fall(s, 'chute', 1, MOONSTONE, PORCH.rules)
    expect(hudMeasure(PORCH, s)).toEqual({ label: 'Moonstones', value: '1/9' })
    expect(hudStars(PORCH, s)).toMatchObject({ stars: 0, note: 'finish for ★' })
    const over = { ...s, phase: 'over' as const }
    expect(headline(PORCH, over)).toEqual({ value: '1', caption: 'moonstones in the jar' })
    expect(nextStarSentence(PORCH, over)).toBe('5 moonstones in the jar for 2 stars.')
  })

  it('shows the stars a target run would earn if it ended now', () => {
    const s = { ...drop(initialState(BRAMBLE.rules)), coinsLeft: 13, score: 20 }
    expect(hudMeasure(BRAMBLE, s)).toEqual({ label: 'Fed', value: '20/30' })
    expect(hudStars(BRAMBLE, s)).toMatchObject({ stars: 3, note: 'if done now' })
  })

  it('reads a missed target as progress, and a met one as coins to spare', () => {
    const missed = { ...initialState(BRAMBLE.rules), phase: 'over' as const, score: 22 }
    expect(headline(BRAMBLE, missed)).toEqual({ value: '22/30', caption: 'fed' })
    expect(nextStarSentence(BRAMBLE, missed)).toBe('Reach 30 to earn a star.')
    const met = { ...missed, score: 30, spareAtGoal: 6 }
    expect(headline(BRAMBLE, met)).toEqual({ value: '6', caption: 'chocolates left in the tin' })
    expect(nextStarSentence(BRAMBLE, met)).toBe(
      'Finish with 12 chocolates left in the tin for 3 stars.'
    )
  })
})
