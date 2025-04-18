import { useRef, useCallback, useState } from 'react';
import { Character, ChatMessage } from '../types';
import { useStore } from '../store';
import { useConversationManager, useCharacterResponse } from '../api/hooks';

const INTER_RESPONSE_DELAY_MS = 500;
const TYPING_SIMULATION_DELAY_MS = 0;
const PROCESSING_RESET_DELAY_MS = 500;

// Maximum allowed consecutive character responses before requiring user input
const MAX_CONSECUTIVE_CHARACTER_RESPONSES = 4;

export function useCharacterResponses() {
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const activeResponsesRef = useRef<{[key: string]: boolean}>({});
  const responseQueueRef = useRef<Array<{character: Character, message: string}>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const { messages, consecutiveCharacterResponses } = useStore((state) => state.chat);
  const addCharacterMessage = useStore((state) => state.addCharacterMessage);
  const addTypingCharacter = useStore((state) => state.addTypingCharacter);
  const removeTypingCharacter = useStore((state) => state.removeTypingCharacter);
  const characters = useStore((state) => state.userList.characters);
  const charactersRespondToEachOther = useStore((state) => state.chat.charactersRespondToEachOther);
  const setConsecutiveCharacterResponses = useStore((state) => state.setConsecutiveCharacterResponses);
  const conversationManager = useConversationManager();
  const characterResponse = useCharacterResponse();

  // Process character responses one at a time from the queue
  const processResponseQueue = useCallback(async (chatMessages: ChatMessage[]) => {
    isProcessingQueueRef.current = true;
    try {
      while (responseQueueRef.current.length > 0) {
        const { character } = responseQueueRef.current.shift()!;
        // Prevent removed characters from responding
        const stillActive = characters.some(c => c.id === character.id);
        if (!stillActive) continue;
        // Limit consecutive character responses
        if (consecutiveCharacterResponses >= MAX_CONSECUTIVE_CHARACTER_RESPONSES) {
          setConsecutiveCharacterResponses(MAX_CONSECUTIVE_CHARACTER_RESPONSES);
          break;
        }
        const responseId = `${character.id}-${Date.now()}`;
        activeResponsesRef.current[responseId] = true;
        try {
          addTypingCharacter(character);
          await new Promise(resolve => setTimeout(resolve, TYPING_SIMULATION_DELAY_MS));
          if (!activeResponsesRef.current[responseId]) {
            removeTypingCharacter(character.id);
            continue;
          }
          const characterResult = await characterResponse.mutateAsync({ character, chatMessages });
          if (!activeResponsesRef.current[responseId]) {
            removeTypingCharacter(character.id);
            continue;
          }
          addCharacterMessage(character, characterResult.response);
          await new Promise(resolve => setTimeout(resolve, INTER_RESPONSE_DELAY_MS));
        } catch {
          const fallbackResponses = [
            `I'm not sure what to say about that.`,
            `That's interesting. Tell me more.`,
            `I'm thinking about how to respond to that.`,
            `I'd like to hear more about your perspective.`
          ];
          const fallbackResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
          addCharacterMessage(character, fallbackResponse);
        } finally {
          removeTypingCharacter(character.id);
          delete activeResponsesRef.current[responseId];
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [addTypingCharacter, removeTypingCharacter, addCharacterMessage, characterResponse, characters, consecutiveCharacterResponses, setConsecutiveCharacterResponses]);

  // Main handler for getting character responses
  const handleGetCharacterResponses = useCallback(async (messageText: string, messageId?: string) => {
    if (isProcessingResponse) return;
    if (messageId && messageId === lastMessageIdRef.current) return;
    setIsProcessingResponse(true);
    if (messageId) lastMessageIdRef.current = messageId;
    activeResponsesRef.current = {};
    try {
      const chatMessages = [...(messages || []), {
        id: 'temp',
        character: { id: 'user', name: 'You', description: 'Current user' },
        message: messageText,
        timestamp: Date.now(),
      }];
      if (!characters || characters.length === 0) {
        setIsProcessingResponse(false);
        return;
      }
      const result = await conversationManager.mutateAsync({ 
        chatMessages, 
        characters,
        charactersRespondToEachOther
      });
      if (!result.respondingCharacters || result.respondingCharacters.length === 0) {
        setIsProcessingResponse(false);
        return;
      }
      result.respondingCharacters.forEach(character => {
        responseQueueRef.current.push({ character, message: messageText });
      });
      if (!isProcessingQueueRef.current) {
        processResponseQueue(chatMessages);
      }
    } finally {
      setTimeout(() => setIsProcessingResponse(false), PROCESSING_RESET_DELAY_MS);
    }
  }, [messages, characters, conversationManager, charactersRespondToEachOther, isProcessingResponse, processResponseQueue]);

  // Expose for integration
  return {
    handleGetCharacterResponses,
    isProcessingResponse,
    isProcessingQueueRef,
    responseQueueRef,
    activeResponsesRef
  };
}
