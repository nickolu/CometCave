import { useMutation } from '@tanstack/react-query';
import { agentApi } from './client';
import type { Character, ChatMessage } from './types';

export function useSafetyCheck() {
  return useMutation({
    mutationFn: (message: string) => agentApi.safety.checkMessage(message),
  });
}

export function useCharacterResponse() {
  return useMutation({
    mutationFn: ({ character, chatMessages }: { character: Character; chatMessages: ChatMessage[] }) =>
      agentApi.character.getResponse(character, chatMessages),
  });
}

export function useConversationManager() {
  return useMutation({
    mutationFn: ({ chatMessages, characters }: { chatMessages: ChatMessage[]; characters: Character[] }) =>
      agentApi.conversationManager.getRespondingCharacter(chatMessages, characters),
  });
}

export function useCharacterGenerator() {
  return useMutation({
    mutationFn: ({ previousCharacters, criteria }: { previousCharacters: Character[]; criteria: string }) =>
      agentApi.characterGenerator.generateCharacters(previousCharacters, criteria),
  });
}
