import {
  type GameState,
  type RuleConfig,
  SETTLE_MAX_S,
  SETTLE_QUIET_S,
  beatDrop,
  canDrop,
  classicBonus,
  drop,
  fall,
  goalCount,
  initialState,
  nextStar,
  pourBonus,
  resolveShot,
  resultValue,
  ringBonus,
  setTowers,
  starsFor,
  tempoIdle,
  tick,
  validateRules,
} from './rules'

const RULES: RuleConfig = {
  coins: 40,
  bonusForStreak: classicBonus,
  goal: { type: 'score', stars: [20, 32, 44] },
}
const UNLIMITED: RuleConfig = {
  coins: null,
  timeLimitS: 60,
  bonusForStreak: classicBonus,
  goal: { type: 'score', stars: [10, 20, 30] },
}
const COLLECT: RuleConfig = {
  coins: 30,
  bonusForStreak: () => 2,
  goal: { type: 'collect', object: 'moonstone', total: 9, stars: [0, 5, 9] },
}
const TARGET: RuleConfig = {
  coins: 40,
  bonusForStreak: () => 2,
  goal: { type: 'target', count: 30, stars: [0, 5, 12] },
}
const MOONSTONE = { id: 'moonstone', points: 1, refund: 3 }
const TRUFFLE = { id: 'truffle', points: 3, refund: 0 }

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
    expect(() => validateRules({ ...RULES, goal: { type: 'score', stars: [20, 20, 44] } })).toThrow(
      /rise/
    )
  })

  it('allows a star for finishing only where the goal is not a score', () => {
    expect(() => validateRules({ ...RULES, goal: { type: 'score', stars: [0, 5, 9] } })).toThrow(
      /rise/
    )
    expect(() => validateRules(COLLECT)).not.toThrow()
  })

  it('refuses three stars that need more objects than the stage holds', () => {
    const greedy: RuleConfig = { ...COLLECT, goal: { ...COLLECT.goal, stars: [0, 5, 10] } as const }
    expect(() => validateRules(greedy)).toThrow(/holds/)
  })

  it('refuses a target goal whose spare-coin stars the budget cannot cover', () => {
    expect(() => validateRules({ ...TARGET, coins: 10 })).toThrow(/budget/)
    expect(() => validateRules({ ...TARGET, coins: null, timeLimitS: 60 })).toThrow(/budget/)
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

  it("scores an object's points and counts it by kind", () => {
    let s = fall(initialState(TARGET), 'chute', 1, TRUFFLE, TARGET)
    s = fall(s, 'chute', 2, undefined, TARGET)
    expect(s.score).toBe(4)
    expect(s.collected).toEqual({ truffle: 1, coin: 1 })
  })

  it('counts nothing for an object in the gutter', () => {
    const s = fall(initialState(COLLECT), 'gutter', 1, MOONSTONE, COLLECT)
    expect(s.collected).toEqual({})
    expect(s.coinsLeft).toBe(30)
  })

  it('refunds coins, and plays on if they come back after the last was spent', () => {
    const settling = {
      ...initialState(COLLECT),
      phase: 'settling' as const,
      coinsLeft: 0,
      settleStartedAt: 5,
    }
    const s = fall(settling, 'chute', 6, MOONSTONE, COLLECT)
    expect(s.coinsLeft).toBe(3)
    expect(s.phase).toBe('playing')
    expect(canDrop(s)).toBe(true)
  })
})

describe('goals', () => {
  it('ends a collect stage once every object is in', () => {
    let s = drop(initialState(COLLECT))
    for (let i = 0; i < 8; i++) s = fall(s, 'chute', i, MOONSTONE, COLLECT)
    expect(s.phase).toBe('playing')
    s = fall(s, 'chute', 9, MOONSTONE, COLLECT)
    expect(s.phase).toBe('over')
    expect(starsFor(s, COLLECT.goal)).toBe(3)
  })

  it('gives the finishing star only once a collect stage is over', () => {
    const playing = drop(initialState(COLLECT))
    expect(starsFor(playing, COLLECT.goal)).toBe(0)
    expect(nextStar(playing, COLLECT.goal)).toEqual({ stars: 1, at: 0 })
    expect(starsFor({ ...playing, phase: 'over' }, COLLECT.goal)).toBe(1)
  })

  it('ends a target stage when it is reached and keeps the coins to spare', () => {
    let s: GameState = { ...drop(initialState(TARGET)), coinsLeft: 7 }
    for (let i = 0; i < 29; i++) s = fall(s, 'chute', i, undefined, TARGET)
    expect(s.phase).toBe('playing')
    expect(starsFor(s, TARGET.goal)).toBe(0)
    s = fall(s, 'chute', 30, undefined, TARGET)
    expect(s.phase).toBe('over')
    expect(s.spareAtGoal).toBe(7)
    expect(starsFor(s, TARGET.goal)).toBe(2)
    expect(nextStar(s, TARGET.goal)).toEqual({ stars: 3, at: 12 })
    expect(resultValue(s, TARGET.goal)).toBe(7)
  })

  it('has no result to keep when a target is missed', () => {
    const s = { ...initialState(TARGET), phase: 'over' as const, score: 22 }
    expect(starsFor(s, TARGET.goal)).toBe(0)
    expect(resultValue(s, TARGET.goal)).toBeNull()
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
  const scored = (score: number) => ({ ...initialState(RULES), score })

  it('counts thresholds reached', () => {
    expect(
      [0, 19, 20, 31, 32, 43, 44, 90].map(score => starsFor(scored(score), RULES.goal))
    ).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('names the next star to earn', () => {
    expect(nextStar(scored(0), RULES.goal)).toEqual({ stars: 1, at: 20 })
    expect(nextStar(scored(33), RULES.goal)).toEqual({ stars: 3, at: 44 })
    expect(nextStar(scored(44), RULES.goal)).toBeNull()
  })
})

describe('stack goal', () => {
  const rules: RuleConfig = {
    coins: 30,
    bonusForStreak: () => 0,
    goal: { type: 'stack', weights: [1, 2, 1], stars: [6, 18, 32] },
  }

  it('weights each tower and counts the total', () => {
    const s = setTowers(drop(initialState(rules)), [4, 3, 5])
    expect(goalCount(s, rules.goal)).toBe(15)
    expect(starsFor(s, rules.goal)).toBe(1)
  })

  it('freezes the towers once the stage is over', () => {
    const s = { ...setTowers(initialState(rules), [4, 3, 5]), phase: 'over' as const }
    expect(setTowers(s, [0, 0, 0]).towers).toEqual([4, 3, 5])
  })

  it("keeps the same state when nothing changed, so the HUD needn't re-render", () => {
    const s = setTowers(initialState(rules), [1, 0, 0])
    expect(setTowers(s, [1, 0, 0])).toBe(s)
  })
})

describe('tempo', () => {
  const TEMPO: RuleConfig = {
    coins: 40,
    timeLimitS: 90,
    tempo: { max: 6, idleS: 3 },
    bonusForStreak: () => 3,
    goal: { type: 'score', stars: [15, 30, 45] },
  }

  it('climbs a step per drop on the beat, up to the top, and falls to 1 off it', () => {
    let s = initialState(TEMPO)
    expect(s.tempo).toBe(1)
    for (let i = 0; i < 8; i++) s = beatDrop(s, true, i, TEMPO)
    expect(s.tempo).toBe(6)
    s = beatDrop(s, false, 9, TEMPO)
    expect(s.tempo).toBe(1)
    expect(s.bestTempo).toBe(6)
  })

  it('loses a step for every pause of idleS', () => {
    let s = initialState(TEMPO)
    for (let i = 0; i < 4; i++) s = beatDrop(s, true, i, TEMPO)
    expect(s.tempo).toBe(5)
    expect(tempoIdle(s, 5.9, TEMPO).tempo).toBe(5)
    s = tempoIdle(s, 6, TEMPO)
    expect(s.tempo).toBe(4)
    s = tempoIdle(s, 9, TEMPO)
    expect(s.tempo).toBe(3)
  })

  it('multiplies the ring bonus by the tempo the drop was made at', () => {
    expect(ringBonus(1, 4, TEMPO)).toBe(12)
    expect(resolveShot(initialState(TEMPO), true, TEMPO, 5).showerLeft).toBe(15)
    // A stage without a tempo ignores it.
    expect(ringBonus(1, 4, RULES)).toBe(classicBonus(1))
    expect(beatDrop(initialState(RULES), true, 0, RULES).tempo).toBe(1)
  })

  it('stops drops when the clock runs out, coins or not', () => {
    const s = drop(initialState(TEMPO))
    expect(canDrop(tick(s, 200, 0, TEMPO, 89.9))).toBe(true)
    const up = tick(s, 200, 0, TEMPO, 90)
    expect(up.timeUp).toBe(true)
    expect(up.coinsLeft).toBe(39)
    expect(canDrop(up)).toBe(false)
  })
})
