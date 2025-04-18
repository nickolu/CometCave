import { act } from 'react';
import { useStore } from '../store';
import { Character } from '../types';

describe('Character Response Logic', () => {
  beforeEach(() => {
    useStore.setState({
      chat: {
        ...useStore.getState().chat,
        messages: [],
        charactersRespondToEachOther: false,
      },
    });
  });

  it('never adds a message with id "temp" to the chat state', () => {
    const character: Character = {
      id: 'char-1',
      name: 'Alice',
      description: 'Test character',
    };
    act(() => {
      useStore.setState((state) => ({
        chat: {
          ...state.chat,
          messages: [
            ...(state.chat.messages || []),
            {
              id: 'temp',
              character,
              message: 'This is a temp message',
              timestamp: Date.now(),
            },
          ],
        },
      }));
      useStore.getState().addCharacterMessage(character, 'This is a real message');
    });
    const messages = useStore.getState().chat.messages;
    expect(messages.some((msg) => msg.id === 'temp')).toBe(false);
    expect(messages.some((msg) => msg.message === 'This is a real message')).toBe(true);
  });
});

