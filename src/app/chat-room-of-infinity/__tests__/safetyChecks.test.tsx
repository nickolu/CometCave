import { act } from 'react'
import { renderHook } from '@testing-library/react'
import { useChatSafety } from '../hooks/useChatSafety'

// Mock the useSafetyCheck hook to simulate API responses
jest.mock('../api/hooks', () => ({
  useSafetyCheck: () => ({
    mutateAsync: jest.fn((msg: string) => {
      if (msg === 'safe') return Promise.resolve({ safe: true })
      if (msg === 'isSafe') return Promise.resolve({ isSafe: true })
      if (msg === 'unsafe') return Promise.resolve({ safe: false, reason: 'Not safe' })
      return Promise.resolve({})
    }),
  }),
}))

describe('Safety & Error Handling', () => {
  it('accepts safe property as valid', async () => {
    const { result } = renderHook(() => useChatSafety())
    let safetyResult
    await act(async () => {
      safetyResult = (await result.current.checkSafety('safe')) as { safe: boolean }
    })

    expect(safetyResult!.safe).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('accepts isSafe property as valid', async () => {
    const { result } = renderHook(() => useChatSafety())
    let safetyResult
    await act(async () => {
      safetyResult = (await result.current.checkSafety('isSafe')) as { safe: boolean }
    })

    expect(safetyResult!.safe).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('handles unsafe response with reason', async () => {
    const { result } = renderHook(() => useChatSafety())
    let safetyResult
    await act(async () => {
      safetyResult = await result.current.checkSafety('unsafe')
    })
    expect(safetyResult!.safe).toBe(false)
    expect(result.current.error).toBe('Not safe')
  })

  it('falls back gracefully for missing safety properties', async () => {
    const { result } = renderHook(() => useChatSafety())
    let safetyResult
    await act(async () => {
      safetyResult = await result.current.checkSafety('unknown')
    })
    expect(safetyResult!.safe).toBe(false)
    expect(result.current.error).toBe('Failed to check message safety')
  })
})
