import {
  COIN_BUDGET,
  SETTLE_MAX_S,
  SETTLE_QUIET_S,
  bonusForStreak,
  canDrop,
  drop,
  fall,
  initialState,
  pourBonus,
  resolveShot,
  tick,
} from './rules'

describe('bonusForStreak', () => {
  it('grows by 5 per consecutive hit and tops out at 25', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(bonusForStreak)).toEqual([5, 10, 15, 20, 25, 25, 25])
  })
})

describe('dropping', () => {
  it('spends the budget and then stops', () => {
    let s = initialState()
    for (let i = 0; i < COIN_BUDGET; i++) s = drop(s)
    expect(s.coinsLeft).toBe(0)
    expect(canDrop(s)).toBe(false)
    expect(drop(s)).toBe(s)
  })

  it('starts the game on the first drop', () => {
    expect(drop(initialState()).phase).toBe('playing')
  })
})

describe('resolveShot', () => {
  it('builds a streak and queues its bonus', () => {
    let s = initialState()
    s = resolveShot(s, true)
    s = resolveShot(s, true)
    expect(s.streak).toBe(2)
    expect(s.showerLeft).toBe(5 + 10)
    expect(s.hits).toBe(2)
  })

  it('resets the streak on a miss but keeps the best', () => {
    let s = resolveShot(resolveShot(initialState(), true), true)
    s = resolveShot(s, false)
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(s.shots).toBe(3)
  })

  it('pours the bonus one coin at a time', () => {
    let s = resolveShot(initialState(), true)
    s = pourBonus(s)
    expect(s.showerLeft).toBe(4)
  })
})

describe('falls', () => {
  it('scores the chute and not the gutters', () => {
    let s = fall(initialState(), 'chute', 1)
    s = fall(s, 'gutter', 2)
    expect(s.score).toBe(1)
    expect(s.lost).toBe(1)
  })

  it('ignores falls after the game is over', () => {
    const over = { ...initialState(), phase: 'over' as const }
    expect(fall(over, 'chute', 1)).toBe(over)
  })
})

describe('ending', () => {
  const spent = () => ({ ...initialState(), phase: 'playing' as const, coinsLeft: 0 })

  it('waits for coins in flight and the bonus pour before settling', () => {
    expect(tick(spent(), 10, 1).phase).toBe('playing')
    expect(tick({ ...spent(), showerLeft: 3 }, 10, 0).phase).toBe('playing')
    expect(tick(spent(), 10, 0).phase).toBe('settling')
  })

  it('ends once nothing has fallen for a while', () => {
    let s = tick(spent(), 10, 0)
    s = fall(s, 'chute', 12)
    expect(tick(s, 12 + SETTLE_QUIET_S - 0.1, 0).phase).toBe('settling')
    expect(tick(s, 12 + SETTLE_QUIET_S, 0).phase).toBe('over')
  })

  it('ends after the cap even if coins keep trickling off', () => {
    let s = tick(spent(), 10, 0)
    s = fall(s, 'chute', 10 + SETTLE_MAX_S - 1)
    expect(tick(s, 10 + SETTLE_MAX_S, 0).phase).toBe('over')
  })
})
