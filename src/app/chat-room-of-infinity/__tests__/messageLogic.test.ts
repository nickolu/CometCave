import { act } from 'react'
import { useStore } from '../store'
import { ChatMessage } from '../types'

describe('Message Sending Logic', () => {
  beforeEach(() => {
    // Reset the Zustand store state before each test
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: [],
      },
    })
  })

  it('appends a user message to messages array', () => {
    act(() => {
      useStore.getState().sendMessage('Hello world')
    })
    const messages = useStore.getState().chat.messages
    expect(messages.length).toBe(1)
    expect(messages[0].message).toBe('Hello world')
  })

  it('handles sending when messages array is undefined', () => {
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: undefined as unknown as ChatMessage[],
      },
    })
    act(() => {
      useStore.getState().sendMessage('Test')
    })
    const messages = useStore.getState().chat.messages
    expect(Array.isArray(messages)).toBe(true)
    expect(messages[0].message).toBe('Test')
  })

  it('prevents sending empty or blank messages', () => {
    act(() => {
      useStore.getState().sendMessage('   ')
    })
    const messages = useStore.getState().chat.messages
    expect(messages.length).toBe(0)
  })
})
