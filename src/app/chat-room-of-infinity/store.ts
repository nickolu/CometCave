'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatState, Character, UserListState, UserSelectorState, CustomCharacterFormState } from './types';

export interface Store {
  // User List State
  userList: UserListState;
  toggleUserList: () => void;
  addCharacter: (character: Character) => void;
  removeCharacter: (characterId: string) => void;
  
  // Chat State
  chat: ChatState;
  sendMessage: (message: string) => void;
  setIsTyping: (isTyping: boolean) => void;
  
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

      chat: {
        messages: [],
        isTyping: false,
      },
      sendMessage: (message: string) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, {
            id: Math.random().toString(),
            character: { id: 'user', name: 'You', description: 'Current user' },
            message,
            timestamp: Date.now(),
          }]
        }
      })),
      setIsTyping: (isTyping: boolean) => set((state) => ({
        chat: { ...state.chat, isTyping }
      })),

      userSelector: {
        isOpen: false,
        availableCharacters: [], // To be populated with character suggestions
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
        const newCharacter: Character = {
          id: Math.random().toString(),
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
            characters: [...state.userList.characters, newCharacter]
          }
        };
      }),
    }),
    {
      name: 'chat-room-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        userList: state.userList,
        chat: state.chat,
      }),
    }
  )
);
