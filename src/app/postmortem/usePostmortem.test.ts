// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { usePostmortem } from './usePostmortem'

function setup() {
  const hook = renderHook(() => usePostmortem({ keysActive: false, rng: () => 0 }))
  const hand = () => hook.result.current.run.hands[hook.result.current.run.index]
  return { hook, hand }
}

describe('usePostmortem lock in and lifeline', () => {
  it('pressing a card twice selects then unselects without playing', () => {
    const { hook, hand } = setup()
    act(() => hook.result.current.pressCard(0))
    expect(hook.result.current.run.armed).toBe(hand()[0])
    act(() => hook.result.current.pressCard(0))
    expect(hook.result.current.run.armed).toBeNull()
    expect(hook.result.current.run.played).toEqual([])
  })

  it('lockIn plays the selected card and clears the selection', () => {
    const { hook, hand } = setup()
    act(() => hook.result.current.pressCard(2))
    act(() => hook.result.current.lockIn())
    expect(hook.result.current.run.played).toEqual([hand()[2]])
    expect(hook.result.current.run.armed).toBeNull()
  })

  it('lockIn with nothing selected shows a notice', () => {
    const { hook } = setup()
    act(() => hook.result.current.lockIn())
    expect(hook.result.current.run.played).toEqual([])
    expect(hook.result.current.notice).toBe('Select a card first.')
  })

  it('eliminate is a no-op while a card is selected', () => {
    const { hook } = setup()
    act(() => hook.result.current.pressCard(0))
    act(() => hook.result.current.eliminate())
    expect(hook.result.current.run.eliminated).toEqual([])
    expect(hook.result.current.multiplier).toBe(3)
    expect(hook.result.current.notice).toBe('Unselect your card to use the lifeline.')
  })

  it('eliminate works with nothing selected and costs one multiplier step', () => {
    const { hook } = setup()
    act(() => hook.result.current.eliminate())
    expect(hook.result.current.run.eliminated).toHaveLength(1)
    expect(hook.result.current.multiplier).toBe(2)
    expect(hook.result.current.eliminationsLeft).toBe(1)
  })
})
