'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatState, Character, UserListState, UserSelectorState, CustomCharacterFormState, HumanUser } from './types';
import SAMPLE_CHARACTERS from './sampleCharacters.json';

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
  setIsTyping: (isTyping: boolean) => void;
  resetChat: () => void;
  
  // User Selector State
  userSelector: UserSelectorState;
  toggleUserSelector: () => void;
  
  // Custom Character Form State
  customCharacterForm: CustomCharacterFormState;
  toggleCustomCharacterForm: () => void;
  updateCustomCharacterForm: (updates: Partial<CustomCharacterFormState>) => void;
  saveCustomCharacter: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      userList: {
        isCollapsed: false,
        characters: [],
        humanUser: {
          name: 'You',
          status: 'online'
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
          humanUser: { ...state.userList.humanUser, ...updates }
        }
      })),

      chat: {
        messages: [],
        isTyping: false,
      },
      sendMessage: (message: string) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, {
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
          isTyping: false,
        }
      })),
      setIsTyping: (isTyping: boolean) => set((state) => ({
        chat: { ...state.chat, isTyping }
      })),

      resetChat: () => set(() => ({
        chat: {
          messages: [],
          isTyping: false
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
      name: 'chat-room-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userList: { 
          characters: state.userList.characters,
          humanUser: state.userList.humanUser,
          isCollapsed: state.userList.isCollapsed
        },
        chat: { messages: state.chat.messages }
      }),
    }
  )
);
