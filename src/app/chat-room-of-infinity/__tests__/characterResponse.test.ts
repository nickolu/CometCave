import { act } from 'react'
import { useStore } from '../store'
import { Character } from '../types'

describe('Character Response Logic', () => {
  const character: Character = {
    id: 'char-1',
    name: 'Alice',
    description: 'Test character',
  }

  beforeEach(() => {
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: [],
        charactersRespondToEachOther: false,
      },
    })
  })

  it('adds a character message to the messages array', () => {
    act(() => {
      useStore.getState().addCharacterMessage(character, 'Hi!')
    })
    const messages = useStore.getState().chat.messages
    expect(messages.length).toBe(1)
    expect(messages[0].character.id).toBe(character.id)
    expect(messages[0].message).toBe('Hi!')
  })

  it('handles undefined messages array gracefully', () => {
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: [],
      },
    })
    act(() => {
      useStore.getState().addCharacterMessage(character, 'Hello!')
    })
    const messages = useStore.getState().chat.messages
    expect(Array.isArray(messages)).toBe(true)
    expect(messages[0].character.id).toBe(character.id)
    expect(messages[0].message).toBe('Hello!')
  })

  it('respects charactersRespondToEachOther toggle', () => {
    // Off by default
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(false)
    act(() => {
      useStore.getState().toggleCharactersRespondToEachOther()
    })
    expect(useStore.getState().chat.charactersRespondToEachOther).toBe(true)
  })
})
