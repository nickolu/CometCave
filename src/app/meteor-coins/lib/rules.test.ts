import {
  type RuleConfig,
  SETTLE_MAX_S,
  SETTLE_QUIET_S,
  canDrop,
  classicBonus,
  drop,
  fall,
  initialState,
  nextStar,
  pourBonus,
  resolveShot,
  starsFor,
  tick,
  validateRules,
} from './rules'

const RULES: RuleConfig = { coins: 40, bonusForStreak: classicBonus, stars: [20, 32, 44] }
const UNLIMITED: RuleConfig = {
  coins: null,
  timeLimitS: 60,
  bonusForStreak: classicBonus,
  stars: [10, 20, 30],
}

describe('classicBonus', () => {
  it('grows by 5 per consecutive hit and tops out at 25', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(classicBonus)).toEqual([5, 10, 15, 20, 25, 25, 25])
  })
})

describe('validateRules', () => {
  it('refuses unlimited coins with nothing to end on', () => {
    expect(() => validateRules({ ...UNLIMITED, timeLimitS: undefined })).toThrow(/time limit/)
  })

  it('refuses star thresholds that do not rise', () => {
    expect(() => validateRules({ ...RULES, stars: [20, 20, 44] })).toThrow(/rise/)
  })
})

describe('dropping', () => {
  it('spends the budget and then stops', () => {
    let s = initialState(RULES)
    for (let i = 0; i < 40; i++) s = drop(s)
    expect(s.coinsLeft).toBe(0)
    expect(canDrop(s)).toBe(false)
    expect(drop(s)).toBe(s)
  })

  it('starts the game on the first drop', () => {
    expect(drop(initialState(RULES)).phase).toBe('playing')
  })

  it('never runs out with unlimited coins until the clock does', () => {
    let s = initialState(UNLIMITED)
    for (let i = 0; i < 500; i++) s = drop(s)
    expect(s.coinsLeft).toBeNull()
    expect(canDrop(s)).toBe(true)
    s = tick(s, 60, 0, UNLIMITED)
    expect(s.timeUp).toBe(true)
    expect(canDrop(s)).toBe(false)
  })
})

describe('resolveShot', () => {
  it('builds a streak and queues its bonus from the stage table', () => {
    let s = initialState(RULES)
    s = resolveShot(s, true, RULES)
    s = resolveShot(s, true, RULES)
    expect(s.streak).toBe(2)
    expect(s.showerLeft).toBe(5 + 10)
    expect(s.hits).toBe(2)
  })

  it('uses whatever bonus table the stage gives it', () => {
    const flat: RuleConfig = { ...RULES, bonusForStreak: () => 2 }
    let s = resolveShot(initialState(flat), true, flat)
    s = resolveShot(s, true, flat)
    expect(s.showerLeft).toBe(4)
  })

  it('resets the streak on a miss but keeps the best', () => {
    let s = resolveShot(resolveShot(initialState(RULES), true, RULES), true, RULES)
    s = resolveShot(s, false, RULES)
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(s.shots).toBe(3)
  })

  it('pours the bonus one coin at a time', () => {
    let s = resolveShot(initialState(RULES), true, RULES)
    s = pourBonus(s)
    expect(s.showerLeft).toBe(4)
  })
})

describe('falls', () => {
  it('scores the chute and not the gutters', () => {
    let s = fall(initialState(RULES), 'chute', 1)
    s = fall(s, 'gutter', 2)
    expect(s.score).toBe(1)
    expect(s.lost).toBe(1)
  })

  it('ignores falls after the game is over', () => {
    const over = { ...initialState(RULES), phase: 'over' as const }
    expect(fall(over, 'chute', 1)).toBe(over)
  })
})

describe('ending', () => {
  const spent = () => ({ ...initialState(RULES), phase: 'playing' as const, coinsLeft: 0 })

  it('waits for coins in flight and the bonus pour before settling', () => {
    expect(tick(spent(), 10, 1, RULES).phase).toBe('playing')
    expect(tick({ ...spent(), showerLeft: 3 }, 10, 0, RULES).phase).toBe('playing')
    expect(tick(spent(), 10, 0, RULES).phase).toBe('settling')
  })

  it('ends once nothing has fallen for a while', () => {
    let s = tick(spent(), 10, 0, RULES)
    s = fall(s, 'chute', 12)
    expect(tick(s, 12 + SETTLE_QUIET_S - 0.1, 0, RULES).phase).toBe('settling')
    expect(tick(s, 12 + SETTLE_QUIET_S, 0, RULES).phase).toBe('over')
  })

  it('ends after the cap even if coins keep trickling off', () => {
    let s = tick(spent(), 10, 0, RULES)
    s = fall(s, 'chute', 10 + SETTLE_MAX_S - 1)
    expect(tick(s, 10 + SETTLE_MAX_S, 0, RULES).phase).toBe('over')
  })

  it('settles when an unlimited stage runs out of time, even before a drop', () => {
    const s = tick(initialState(UNLIMITED), 60, 0, UNLIMITED)
    expect(s.phase).toBe('settling')
  })
})

describe('stars', () => {
  it('counts thresholds reached', () => {
    expect([0, 19, 20, 31, 32, 43, 44, 90].map(score => starsFor(score, [20, 32, 44]))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ])
  })

  it('names the next star to earn', () => {
    expect(nextStar(0, [20, 32, 44])).toEqual({ stars: 1, at: 20 })
    expect(nextStar(33, [20, 32, 44])).toEqual({ stars: 3, at: 44 })
    expect(nextStar(44, [20, 32, 44])).toBeNull()
  })
})
