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
}

export interface Store {
  // User List State
  userList: UserListState;
  toggleUserList: () => void;
  addCharacter: (character: Character) => void;
  removeCharacter: (characterId: string) => void;
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
      userList: {
        isCollapsed: false,
        characters: [],
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
        userList: { ...state.userList, characters: [...state.userList.characters, character] }
      })),
      removeCharacter: (characterId: string) => set((state) => ({
        userList: {
          ...state.userList,
          characters: state.userList.characters.filter((c) => c.id !== characterId)
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
        charactersRespondToEachOther: false
      },
      sendMessage: (message: string) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [...(state.chat.messages || []), {
            id: Math.random().toString(36).substring(7),
            character: {
              id: 'user',
              name: 'You',
              description: 'Current user',
              status: 'online'
            },
            message,
            timestamp: Date.now(),
          }],
        }
      })),
      addCharacterMessage: (character: Character, message: string) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [...(state.chat.messages || []), {
            id: Math.random().toString(36).substring(7),
            character,
            message,
            timestamp: Date.now(),
          }],
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
      resetChat: () => set(() => ({
        chat: {
          messages: [],
          characters: [],
          typingCharacters: [],
          isTyping: false,
          charactersRespondToEachOther: false
        }
      })),
      toggleCharactersRespondToEachOther: () => set((state) => ({
        chat: {
          ...state.chat,
          charactersRespondToEachOther: !state.chat.charactersRespondToEachOther
        }
      })),
      userSelector: {
        isOpen: false,
        availableCharacters: SAMPLE_CHARACTERS as Character[], // To be populated with character suggestions
      },
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
        userList: state.userList,
        userSelector: state.userSelector,
        chat: {
          charactersRespondToEachOther: state.chat.charactersRespondToEachOther
        }
      }),
    }
  )
);
