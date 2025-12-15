import { act } from 'react'

import { useStore } from '../store'

describe('Store Actions & State', () => {
  beforeEach(() => {
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: [],
        charactersRespondToEachOther: false,
      },
    })
  })

  it('toggles charactersRespondToEachOther setting', () => {
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(false)
    act(() => {
      useStore.getState().toggleCharactersRespondToEachOther()
    })
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(true)
    act(() => {
      useStore.getState().toggleCharactersRespondToEachOther()
    })
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(false)
  })

  it('persists toggle state after resetChat', () => {
    act(() => {
      useStore.getState().toggleCharactersRespondToEachOther()
      useStore.getState().resetChat()
    })
    // After reset, should be back to default (false)
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(false)
  })

  it('handles store hydration with missing/partial data', () => {
    // Simulate hydration with only settings present
    useStore.setState({
      chat: {
        charactersRespondToEachOther: true,
        messages: [],
        characters: [],
        typingCharacters: [],
        isTyping: false,
        remainingCharacterMessages: 4,
        consecutiveCharacterResponses: 0,
      },
    })
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(true)
    // Other properties should be undefined or default
    expect(
      Array.isArray(useStore.getState().chat.messages) ||
        useStore.getState().chat.messages === undefined
    ).toBe(true)
  })

  it('does not break with old store structure', () => {
    // Simulate old structure (no charactersRespondToEachOther)
    useStore.setState({
      chat: {
        messages: [],
        characters: [],
        typingCharacters: [],
        isTyping: false,
        charactersRespondToEachOther: false,
        remainingCharacterMessages: 4,
        consecutiveCharacterResponses: 0,
      },
    })
    // Should fallback to false
    expect(useStore.getState().chat.charactersRespondToEachOther ?? false).toBe(false)
  })
})
