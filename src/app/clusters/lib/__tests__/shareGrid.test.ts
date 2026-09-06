import { describe, expect, it } from 'vitest'

import { CLUSTERS_SHARE_URL, buildShare } from '@/app/clusters/lib/shareGrid'
import type { ClusterGroup, GuessRecord } from '@/app/clusters/models/clusters'

const SOLUTION: ClusterGroup[] = [
  { tier: 'yellow', title: 'INFORMATION DISPLAYS', words: ['CHART', 'DIAGRAM', 'GRAPH', 'MAP'] },
  { tier: 'green', title: 'ADDITIONAL BENEFIT', words: ['BONUS', 'EXTRA', 'ICING', 'PERK'] },
  { tier: 'blue', title: 'THANKSGIVING FOOD', words: ['GRAVY', 'PIE', 'STUFFING', 'TURKEY'] },
  {
    tier: 'purple',
    title: 'SONG TITLES WITH PARENTHESES',
    words: ['IRAN', 'ISTANBUL', 'MONTERO', 'SATISFACTION'],
  },
]

const byTier = (tier: ClusterGroup['tier']) => SOLUTION.find((g) => g.tier === tier)!

function correct(tier: ClusterGroup['tier'], id: string): GuessRecord {
  return { words: byTier(tier).words, result: 'correct', guessId: id }
}

describe('buildShare', () => {
  it('draws one row per guess, in the order the player selected', () => {
    const share = buildShare({
      puzzleNumber: 86,
      guesses: [
        { words: ['GRAVY', 'PIE', 'STUFFING', 'CHART'], result: 'one-away', guessId: 'g1' },
        correct('blue', 'g2'),
      ],
      groups: SOLUTION,
      solved: [byTier('blue')],
      status: 'in_progress',
      mistakes: 1,
    })
    expect(share.rows).toEqual(['🟦🟦🟦🟨', '🟦🟦🟦🟦'])
  })

  /**
   * The bug this file exists for: solving three groups auto-resolves the
   * fourth, which records no guess. The share grid was dropping it, so a
   * clean win went out as three rows.
   */
  it('includes the forced last group, which never had a guess of its own', () => {
    const share = buildShare({
      puzzleNumber: 86,
      guesses: [correct('blue', 'g1'), correct('yellow', 'g2'), correct('green', 'g3')],
      groups: SOLUTION,
      // Solve order, with purple appended by the server's auto-resolve.
      solved: [byTier('blue'), byTier('yellow'), byTier('green'), byTier('purple')],
      status: 'won',
      mistakes: 0,
    })
    expect(share.rows).toEqual(['🟦🟦🟦🟦', '🟨🟨🟨🟨', '🟩🟩🟩🟩', '🟪🟪🟪🟪'])
  })

  it('never invents a row for a group a loss merely revealed', () => {
    const share = buildShare({
      puzzleNumber: 86,
      guesses: [
        correct('yellow', 'g1'),
        { words: ['GRAVY', 'PIE', 'STUFFING', 'IRAN'], result: 'one-away', guessId: 'g2' },
        { words: ['BONUS', 'EXTRA', 'ICING', 'IRAN'], result: 'one-away', guessId: 'g3' },
        { words: ['GRAVY', 'PIE', 'TURKEY', 'MONTERO'], result: 'wrong', guessId: 'g4' },
        { words: ['BONUS', 'EXTRA', 'PERK', 'ISTANBUL'], result: 'wrong', guessId: 'g5' },
      ],
      groups: SOLUTION,
      // On a loss the reveal appends the groups the player never found.
      solved: [byTier('yellow'), byTier('green'), byTier('blue'), byTier('purple')],
      status: 'lost',
      mistakes: 4,
    })
    expect(share.rows).toEqual(['🟨🟨🟨🟨', '🟦🟦🟦🟪', '🟩🟩🟩🟪', '🟦🟦🟦🟪', '🟩🟩🟩🟪'])
  })

  it('leaves duplicate guesses out — they were never really plays', () => {
    const share = buildShare({
      puzzleNumber: 86,
      guesses: [
        correct('blue', 'g1'),
        { words: byTier('blue').words, result: 'duplicate', guessId: 'g2' },
      ],
      groups: SOLUTION,
      solved: [byTier('blue')],
      status: 'in_progress',
      mistakes: 0,
    })
    expect(share.rows).toEqual(['🟦🟦🟦🟦'])
  })
})

describe('the share text', () => {
  const won = (mistakes: number, guesses: GuessRecord[]) =>
    buildShare({
      puzzleNumber: 86,
      guesses,
      groups: SOLUTION,
      solved: [byTier('blue'), byTier('yellow'), byTier('green'), byTier('purple')],
      status: 'won',
      mistakes,
    })

  const clean = [correct('blue', 'g1'), correct('yellow', 'g2'), correct('green', 'g3')]

  it('ends with a link to play', () => {
    const share = won(0, clean)
    expect(share.url).toBe(CLUSTERS_SHARE_URL)
    expect(share.text.split('\n').at(-1)).toBe(CLUSTERS_SHARE_URL)
  })

  it('separates the grid from the link with a blank line', () => {
    expect(won(0, clean).text.split('\n').at(-2)).toBe('')
  })

  it('says perfect when the run cost nothing', () => {
    expect(won(0, clean).title).toBe('Clusters #86 · perfect')
  })

  it('counts mistakes, and gets the singular right', () => {
    expect(won(1, clean).title).toBe('Clusters #86 · 1 mistake')
    expect(won(2, clean).title).toBe('Clusters #86 · 2 mistakes')
  })

  it('says unsolved for a loss rather than reporting four mistakes', () => {
    const share = buildShare({
      puzzleNumber: 86,
      guesses: [],
      groups: SOLUTION,
      solved: SOLUTION,
      status: 'lost',
      mistakes: 4,
    })
    expect(share.title).toBe('Clusters #86 · unsolved')
  })

  it('is exactly the title, the grid and the link', () => {
    expect(won(0, clean).text).toBe(
      ['Clusters #86 · perfect', '🟦🟦🟦🟦', '🟨🟨🟨🟨', '🟩🟩🟩🟩', '🟪🟪🟪🟪', '', CLUSTERS_SHARE_URL].join(
        '\n'
      )
    )
  })

  it('gives away no words or category titles', () => {
    const text = won(2, clean).text
    for (const group of SOLUTION) {
      expect(text).not.toContain(group.title)
      for (const word of group.words) expect(text).not.toContain(word)
    }
  })
})
