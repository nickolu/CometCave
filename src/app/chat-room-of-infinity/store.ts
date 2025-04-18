'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, UserListState, UserSelectorState, CustomCharacterFormState, HumanUser, ChatMessage } from './types';
import SAMPLE_CHARACTERS from './sampleCharacters.json';

interface ChatState {
  messages: ChatMessage[];
  characters: Character[];
  typingCharacters: Character[];
  isTyping: boolean;
  charactersRespondToEachOther: boolean;
  consecutiveCharacterResponses: number; // Track consecutive character responses
}

export interface Store {
  setConsecutiveCharacterResponses: (count: number) => void;
  incrementConsecutiveCharacterResponses: () => void;
  // User List State
  userList: UserListState;
  toggleUserList: () => void;
  addCharacter: (character: Character) => void;
  removeCharacter: (characterId: string) => void;
  clearCharacters: () => void;
  updateHumanUser: (updates: Partial<HumanUser>) => void;
  
  // Chat State
  chat: ChatState;
  sendMessage: (message: string) => void;
  addCharacterMessage: (character: Character, message: string) => void;
  setIsTyping: (isTyping: boolean) => void;
  setTypingCharacters: (typingCharacters: Character[]) => void;
  addTypingCharacter: (character: Character) => void;
  removeTypingCharacter: (characterId: string) => void;
  resetChat: () => void;
  toggleCharactersRespondToEachOther: () => void;

  
  // User Selector State
  userSelector: UserSelectorState;
  toggleUserSelector: () => void;
  loadSampleCharacters: () => void;
  addAvailableCharacter: (character: Character) => void;
  
  // Custom Character Form State
  customCharacterForm: CustomCharacterFormState;
  toggleCustomCharacterForm: () => void;
  updateCustomCharacterForm: (updates: Partial<CustomCharacterFormState>) => void;
  saveCustomCharacter: () => void;
}

interface ChatState {
  messages: ChatMessage[];
  characters: Character[];
  typingCharacters: Character[];
  isTyping: boolean;
  charactersRespondToEachOther: boolean;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      setConsecutiveCharacterResponses: (count: number) => set((state) => ({
        chat: { ...state.chat, consecutiveCharacterResponses: count }
      })),
      incrementConsecutiveCharacterResponses: () => set((state) => ({
        chat: { ...state.chat, consecutiveCharacterResponses: (state.chat.consecutiveCharacterResponses || 0) + 1 }
      })),

      userList: {
        isCollapsed: false,
        characters: [], // Initialize with empty array
        humanUser: {
          name: 'User',
          status: 'online' as const,
          description: 'A friendly user',
        },
      },
      toggleUserList: () => set((state) => ({
        userList: { ...state.userList, isCollapsed: !state.userList.isCollapsed }
      })),
      addCharacter: (character: Character) => set((state) => ({
        userList: { ...state.userList, characters: [...state.userList.characters, character] },
        chat: { ...state.chat, characters: [...state.userList.characters, character] }
      })),
      removeCharacter: (characterId: string) => set((state) => {
        const updatedCharacters = state.userList.characters.filter((c) => c.id !== characterId);
        return {
          userList: {
            ...state.userList,
            characters: updatedCharacters
          },
          chat: {
            ...state.chat,
            characters: updatedCharacters
          }
        };
      }),
      clearCharacters: () => set((state) => ({
        userList: {
          ...state.userList,
          characters: []
        },
        chat: {
          ...state.chat,
          characters: [],
          messages: [],
          typingCharacters: []
        }
      })),
      updateHumanUser: (updates: Partial<HumanUser>) => set((state) => ({
        userList: {
          ...state.userList,
          humanUser: { ...state.userList.humanUser, ...updates },
        },
      })),
      chat: {
        messages: [],
        characters: [],
        typingCharacters: [],
        isTyping: false,
        charactersRespondToEachOther: false,
        consecutiveCharacterResponses: 0,
      },
      sendMessage: (message: string) => {
        if (!message || message.trim() === '') return;
        set((state) => ({
          chat: {
            ...state.chat,
            messages: [
              ...((state.chat.messages || []).filter(msg => msg.id !== 'temp')),
              {
                id: Math.random().toString(36).substring(7),
                character: {
                  id: 'user',
                  name: 'You',
                  description: 'Current user',
                  status: 'online'
                },
                message,
                timestamp: Date.now(),
              }
            ],
            consecutiveCharacterResponses: 0, // Reset counter on user message
          }
        }));
      },
      addCharacterMessage: (character: Character, message: string) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [
            ...((state.chat.messages || []).filter(msg => msg.id !== 'temp')),
            {
              id: Math.random().toString(36).substring(7),
              character,
              message,
              timestamp: Date.now(),
            }
          ],
          consecutiveCharacterResponses: (state.chat.consecutiveCharacterResponses || 0) + 1, // Increment counter
        }
      })),
      setIsTyping: (isTyping: boolean) => set((state) => ({
        chat: { ...state.chat, isTyping }
      })),
      setTypingCharacters: (typingCharacters: Character[]) => set((state) => ({
        chat: { ...state.chat, typingCharacters, isTyping: typingCharacters.length > 0 }
      })),
      addTypingCharacter: (character: Character) => set((state) => ({
        chat: { 
          ...state.chat, 
          typingCharacters: [...(state.chat.typingCharacters || []).filter(c => c.id !== character.id), character],
          isTyping: true
        }
      })),
      removeTypingCharacter: (characterId: string) => set((state) => {
        const filteredCharacters = (state.chat.typingCharacters || []).filter(c => c.id !== characterId);
        return {
          chat: { 
            ...state.chat, 
            typingCharacters: filteredCharacters,
            isTyping: filteredCharacters.length > 0
          }
        };
      }),
      resetChat: () => set((state) => ({
        userList: {
          ...state.userList,
          characters: []
        },
        chat: {
          messages: [],
          characters: [],
          typingCharacters: [],
          isTyping: false,
          charactersRespondToEachOther: false,
          consecutiveCharacterResponses: 0,
        }
      })),
      toggleCharactersRespondToEachOther: () => set((state) => ({
      setConsecutiveCharacterResponses: (count: number) => set((state) => ({
        chat: { ...state.chat, consecutiveCharacterResponses: count }
      })),
      incrementConsecutiveCharacterResponses: () => set((state) => ({
        chat: { ...state.chat, consecutiveCharacterResponses: (state.chat.consecutiveCharacterResponses || 0) + 1 }
      })),

        chat: {
          ...state.chat,
          charactersRespondToEachOther: !state.chat.charactersRespondToEachOther
        }
      })),
      userSelector: {
        isOpen: false,
        availableCharacters: [], // Will be populated with sample characters when needed
      },
      loadSampleCharacters: () => set((state) => ({
        userSelector: {
          ...state.userSelector,
          availableCharacters: SAMPLE_CHARACTERS as Character[]
        }
      })),
      addAvailableCharacter: (character: Character) => set((state) => ({
        userSelector: {
          ...state.userSelector,
          availableCharacters: [...state.userSelector.availableCharacters, character]
        }
      })),
      toggleUserSelector: () => set((state) => ({
        userSelector: { ...state.userSelector, isOpen: !state.userSelector.isOpen }
      })),
      customCharacterForm: {
        isOpen: false,
        name: '',
        description: '',
      },
      toggleCustomCharacterForm: () => set((state) => ({
        customCharacterForm: {
          ...state.customCharacterForm,
          isOpen: !state.customCharacterForm.isOpen
        }
      })),
      updateCustomCharacterForm: (updates: Partial<CustomCharacterFormState>) => set((state) => ({
        customCharacterForm: { ...state.customCharacterForm, ...updates }
      })),
      saveCustomCharacter: () => set((state) => {
        const character: Character = {
          id: Math.random().toString(36).substring(7),
          name: state.customCharacterForm.name,
          description: state.customCharacterForm.description,
        };
        return {
          customCharacterForm: {
            isOpen: false,
            name: '',
            description: '',
          },
          userList: {
            ...state.userList,
            characters: [...state.userList.characters, character]
          }
        };
      }),
    }),
    {
      name: 'chat-room-of-infinity-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chat: {
          charactersRespondToEachOther: state.chat.charactersRespondToEachOther
        }
      }),
    }
  )
);
