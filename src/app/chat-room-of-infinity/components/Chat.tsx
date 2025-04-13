'use client';

import { Box, TextField, IconButton, Typography, Fade, Menu, MenuItem, Alert, Switch, FormControlLabel } from '@mui/material';
import { Send, KeyboardArrowDown, MoreVert, DeleteOutline } from '@mui/icons-material';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { Character } from '../types';
import Message from './ChatMessage';
import { ChatMessage } from '../types';
import { useSafetyCheck, useConversationManager, useCharacterResponse } from '../api/hooks';

// Constants for timing values (in milliseconds)
const CHARACTER_RESPONSE_INTERVAL_MS = 2000; // ms between character responses
const USER_TYPING_TIMEOUT_MS = 0;       // ms before clearing typing indicator
const TYPING_SIMULATION_DELAY_MS = 0;    // ms to simulate character typing
const INTER_RESPONSE_DELAY_MS = 500;        // ms between character responses
const PROCESSING_RESET_DELAY_MS = 500;     // ms delay before processing another response

export default function Chat() {
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const { messages, typingCharacters } = useStore((state) => state.chat);
  const sendMessage = useStore((state) => state.sendMessage);
  const addCharacterMessage = useStore((state) => state.addCharacterMessage);
  const addTypingCharacter = useStore((state) => state.addTypingCharacter);
  const removeTypingCharacter = useStore((state) => state.removeTypingCharacter);
  const resetChat = useStore((state) => state.resetChat);
  const toggleCharactersRespondToEachOther = useStore((state) => state.toggleCharactersRespondToEachOther);
  const charactersRespondToEachOther = useStore((state) => state.chat.charactersRespondToEachOther);
  const characters = useStore((state) => state.userList.characters);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const activeResponsesRef = useRef<{[key: string]: boolean}>({});
  const responseQueueRef = useRef<Array<{character: Character, message: string}>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const userTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const characterResponseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyCheck = useSafetyCheck();
  const conversationManager = useConversationManager();
  const characterResponse = useCharacterResponse();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleReset = () => {
    resetChat();
    handleMenuClose();
    
    // Clear any existing character response timer
    if (characterResponseTimerRef.current) {
      clearInterval(characterResponseTimerRef.current);
      characterResponseTimerRef.current = null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!messageContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = messageContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  // Process character responses one at a time from the queue
  const processResponseQueue = useCallback(async (chatMessages: ChatMessage[]) => {
    console.log('===== processResponseQueue called =====');
    console.log('Queue length:', responseQueueRef.current.length);
    console.log('isUserTyping:', isUserTyping);
    console.log('Current queue:', JSON.stringify(responseQueueRef.current));
    
    // Set processing flag
    isProcessingQueueRef.current = true;
    
    try {
      // Process responses one at a time until the queue is empty
      while (responseQueueRef.current.length > 0) {
        // If user is typing, stop processing the queue
        if (isUserTyping) {
          console.log('User is typing, pausing character responses');
          break;
        }
        
        // Get the next character from the queue
        const { character } = responseQueueRef.current.shift()!;
        
        // Generate a unique response ID
        const responseId = `${character.id}-${Date.now()}`;
        activeResponsesRef.current[responseId] = true;
        
        try {
          // Add typing indicator
          addTypingCharacter(character);
          
          // Wait a moment before showing the response (simulates typing)
          await new Promise(resolve => setTimeout(resolve, TYPING_SIMULATION_DELAY_MS));
          
          // Check if user started typing or this response was cancelled
          // Check if user started typing or this response was cancelled
          if (isUserTyping || (responseId in activeResponsesRef.current && !activeResponsesRef.current[responseId])) {
            console.log(`Response from ${character.name} was cancelled`);
            removeTypingCharacter(character.id);
            continue;
          }
          
          console.log(`💬 Requesting response from ${character.name}...`);
          
          try {
            // Check if user started typing before making API call
            if (isUserTyping) {
              console.log(`Response from ${character.name} was cancelled because user started typing`);
              removeTypingCharacter(character.id);
              continue;
            }
            
            // Get the character's response
            const characterResult = await characterResponse.mutateAsync({
              character,
              chatMessages
            });
            
            // Check if user started typing or this response was cancelled
            if (isUserTyping || (responseId in activeResponsesRef.current && !activeResponsesRef.current[responseId])) {
              console.log(`Response from ${character.name} was cancelled after API call`);
              removeTypingCharacter(character.id);
              continue;
            }
            
            console.log(`🗣️ ${character.name} responds:`, characterResult.response);
            
            // Add the character's message to the chat
            addCharacterMessage(character, characterResult.response);
            

            
            // Wait a moment before processing the next response
            await new Promise(resolve => setTimeout(resolve, INTER_RESPONSE_DELAY_MS));
          } catch (responseError) {
            console.error(`Error getting response from ${character.name}:`, responseError);
            
            // Only add fallback if response wasn't cancelled
            if (!(responseId in activeResponsesRef.current) || activeResponsesRef.current[responseId]) {
              // Add a fallback message
              const fallbackResponses = [
                `I'm not sure what to say about that.`,
                `That's interesting. Tell me more.`,
                `I'm thinking about how to respond to that.`,
                `I'd like to hear more about your perspective.`
              ];
              const fallbackResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
              addCharacterMessage(character, fallbackResponse);
            }
          } finally {
            // Always remove typing indicator
            removeTypingCharacter(character.id);
            // Clean up this response tracking
            delete activeResponsesRef.current[responseId];
          }
        } catch (error) {
          console.error(`Error processing response for ${character.name}:`, error);
          removeTypingCharacter(character.id);
          delete activeResponsesRef.current[responseId];
        }
      }
    } finally {
      // Reset processing flag when queue is empty
      isProcessingQueueRef.current = false;
    }
  }, [isUserTyping, removeTypingCharacter, addCharacterMessage, addTypingCharacter, characterResponse]);

  // Handle getting responses from characters
  const handleGetCharacterResponses = useCallback(async (messageText: string, messageId?: string) => {
    console.log('===== handleGetCharacterResponses called =====');
    console.log('Message text:', messageText);
    console.log('Message ID:', messageId);
    console.log('isProcessingResponse:', isProcessingResponse);
    console.log('isProcessingQueue:', isProcessingQueueRef.current);
    
    // If we're already processing a response, don't start another one
    if (isProcessingResponse) {
      console.log('Already processing a response, skipping');
      return;
    }
    
    // If this is the same message we just processed, don't process it again
    if (messageId && messageId === lastMessageIdRef.current) {
      console.log('Already processed this message, skipping');
      return;
    }
    
    // Set processing flag
    setIsProcessingResponse(true);
    if (messageId) {
      lastMessageIdRef.current = messageId;
    }
    
    // Cancel any ongoing responses
    activeResponsesRef.current = {};
    
    try {
      console.log('📨 Getting character responses for:', messageText);
      console.log('Available characters:', characters);
      
      // Get all chat messages for context
      const chatMessages = [...(messages || []), {
        id: 'temp',
        character: {
          id: 'user',
          name: 'You',
          description: 'Current user',
        },
        message: messageText,
        timestamp: Date.now(),
      }];
      
      // Make sure we have characters to work with
      if (!characters || characters.length === 0) {
        console.log('No characters available to respond!');
        setIsProcessingResponse(false);
        return;
      }


      
      // Get characters who should respond
      const result = await conversationManager.mutateAsync({ 
        chatMessages, 
        characters,
        charactersRespondToEachOther
      });
      
      console.log('🎭 Characters who will respond:', result.respondingCharacters);
      

      
      // For each responding character, get their response
      if (!result.respondingCharacters || result.respondingCharacters.length === 0) {
        console.log('No characters selected to respond!');
        setIsProcessingResponse(false);
        return;
      }
      
      // Instead of processing all responses in parallel, add them to a queue
      // This ensures we process one character response at a time
      result.respondingCharacters.forEach(character => {
        // Add each character to the response queue
        responseQueueRef.current.push({
          character,
          message: messageText
        });
      });
      
      // Process the queue if not already processing
      if (!isProcessingQueueRef.current) {
        console.log('Starting to process response queue');
        processResponseQueue(chatMessages);
      } else {
        console.log('Queue already being processed, not starting another process');
      }
      
    } catch (error) {
      console.error('Error in conversation flow:', error);
      
      // Clear all typing indicators
      if (typingCharacters) {
        typingCharacters.forEach(char => removeTypingCharacter(char.id));
      }
    } finally {
      // Always reset processing flag after a delay to prevent immediate re-triggering
      setTimeout(() => {
        setIsProcessingResponse(false);
      }, PROCESSING_RESET_DELAY_MS);
    }
  }, [messages, characters, conversationManager, removeTypingCharacter, typingCharacters, charactersRespondToEachOther, isProcessingResponse, processResponseQueue]);
  



  // Trigger character responses on a timer when characters respond to each other is enabled
  const triggerTimedCharacterResponses = useCallback(() => {
    console.log('⏱️ Timer triggered for character responses');
    
    // Skip if user is typing
    if (isUserTyping) {
      console.log('User is typing, skipping timed character responses');
      return;
    }
    
    // Skip if we're already processing responses
    if (isProcessingResponse || isProcessingQueueRef.current) {
      console.log('Already processing responses, skipping timed character responses');
      return;
    }
    
    // Skip if there are no messages
    if (!messages || messages.length === 0) {
      console.log('No messages to respond to, skipping timed character responses');
      return;
    }
    
    // Get the last message in the chat
    const lastMessage = messages[messages.length - 1];
    
    // Trigger a response to the last message
    console.log('Triggering response to:', lastMessage.message);
    handleGetCharacterResponses(lastMessage.message, lastMessage.id);
  }, [messages, isUserTyping, isProcessingResponse, handleGetCharacterResponses]);

  // Set up or clear the character response timer based on the charactersRespondToEachOther setting
  useEffect(() => {
    // Clear any existing timer
    if (characterResponseTimerRef.current) {
      clearInterval(characterResponseTimerRef.current);
      characterResponseTimerRef.current = null;
    }
    
    // If characters should respond to each other, set up a timer
    if (charactersRespondToEachOther) {
      console.log('Setting up timer for character responses (every 10 seconds)');
      characterResponseTimerRef.current = setInterval(triggerTimedCharacterResponses, CHARACTER_RESPONSE_INTERVAL_MS);
    }
    
    // Cleanup on unmount
    return () => {
      if (characterResponseTimerRef.current) {
        clearInterval(characterResponseTimerRef.current);
      }
    };
  }, [charactersRespondToEachOther, triggerTimedCharacterResponses]);

  // Handle user typing - interrupts character responses
  const handleUserTyping = useCallback(() => {
    // Set user typing state
    console.log('User started typing');
    setIsUserTyping(true);
    
    // Clear any existing timeout
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    
    // Cancel all ongoing character responses
    activeResponsesRef.current = {};
    
    // Clear the response queue
    responseQueueRef.current = [];
    
    // Clear all typing indicators
    if (typingCharacters) {
      typingCharacters.forEach(char => removeTypingCharacter(char.id));
    }
    
    // Reset the character response timer if characters should respond to each other
    if (charactersRespondToEachOther && characterResponseTimerRef.current) {
      console.log('Resetting character response timer due to user typing');
      clearInterval(characterResponseTimerRef.current);
      characterResponseTimerRef.current = setInterval(triggerTimedCharacterResponses, CHARACTER_RESPONSE_INTERVAL_MS);
    }
    
    // Set a timeout to reset the typing state after period of inactivity
    userTypingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
    }, USER_TYPING_TIMEOUT_MS);
  }, [typingCharacters, removeTypingCharacter, charactersRespondToEachOther, triggerTimedCharacterResponses]);
  
  const handleSend = async () => {
    const messageText = input.trim();
    if (messageText === '') return;
    

    
    // Clear typing state and timeout
    setIsUserTyping(false);
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
      userTypingTimeoutRef.current = null;
    }
    
    setIsSubmitting(true);
    console.log('Attempting to send message:', messageText);
    
    try {
      const result = await safetyCheck.mutateAsync(messageText);
      console.log('Safety check result:', result);

      // Check if the message is safe (support both safe and isSafe properties)
      if (result.safe || result.isSafe) {
        console.log('Message is safe, sending...');
        sendMessage(messageText);
        console.log('Message added successfully');
        setInput('');
        scrollToBottom();
        
        // After sending a message, get characters that should respond
        // We don't need to pass an ID here since this is a new user message
        await handleGetCharacterResponses(messageText);
      } else {
        console.log('Message deemed unsafe:', result.reason);
        setError(result.reason);
        // Vibrate the input field
        const inputEl = document.getElementById('chat-input');
        inputEl?.classList.add('shake');
        setTimeout(() => inputEl?.classList.remove('shake'), 500);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      setError('Failed to check message safety');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // No longer automatically adding sample characters
  
  // Listen for new messages and trigger character responses if needed
  useEffect(() => {
    // Skip if we're already processing a response
    if (isProcessingResponse) return;
    
    // Only proceed if we have messages
    if (!messages || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    const isLastMessageFromUser = lastMessage.character.id === 'user';
    
    // Only trigger immediate responses for user messages
    if (isLastMessageFromUser) {
      console.log('Detected new user message, triggering immediate character response');
      
      // If we're in the middle of processing responses, cancel them
      if (isProcessingQueueRef.current) {
        console.log('Canceling previous responses to handle new message');
        // Clear the response queue
        responseQueueRef.current = [];
        
        // Cancel any ongoing responses
        activeResponsesRef.current = {};
        
        // Clear all typing indicators
        if (typingCharacters) {
          typingCharacters.forEach(char => removeTypingCharacter(char.id));
        }
      }
      
      // Pass the message ID to prevent duplicate processing
      handleGetCharacterResponses(lastMessage.message, lastMessage.id);
    }
  }, [messages, isProcessingResponse, handleGetCharacterResponses, typingCharacters, removeTypingCharacter]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, position: 'relative', top: '12px'}}>
        <IconButton onClick={handleMenuOpen} size="small">
          <MoreVert />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleReset}>
            <DeleteOutline sx={{ mr: 1 }} />
            Reset Chat
          </MenuItem>
          <MenuItem>
            <FormControlLabel 
              control={
                <Switch 
                  checked={charactersRespondToEachOther} 
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleCharactersRespondToEachOther();
                  }} 
                />
              }
              label="Characters respond to each other"
              onClick={(e) => e.stopPropagation()}
            />
          </MenuItem>
        </Menu>
      </Box>
      {charactersRespondToEachOther && (
        <Box sx={{ 
          backgroundColor: 'rgba(25, 118, 210, 0.08)', 
          p: 0.5, 
          display: 'flex', 
          justifyContent: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
        }}>
          <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
            Characters will respond to each other
          </Typography>
        </Box>
      )}
      <Box 
        ref={messageContainerRef}
        onScroll={handleScroll}
        sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: 2, 
          display: 'flex', 
          flexDirection: 'column-reverse',
          position: 'relative'
        }}
      >
        <div ref={messagesEndRef} />
        {messages && Array.isArray(messages) ? [...messages].reverse().map((message: ChatMessage) => (
          <Message key={message.id} message={message} />
        )) : null}

      </Box>
      
      {/* Show typing indicators for characters or user */}
      {/* Show typing indicators with improved visibility */}
      {((typingCharacters && typingCharacters.length > 0) || isUserTyping) ? (
        <Box p={1} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.03)', borderTop: '1px solid rgba(0, 0, 0, 0.09)' }}>    
          <Typography variant="body2" sx={{ fontStyle: 'italic', pl: 1 }}>
            {isUserTyping ? (
              'You are typing...'
            ) : typingCharacters && typingCharacters.length === 1 ? (
              `${typingCharacters[0]?.name || 'Someone'} is typing...`
            ) : typingCharacters && typingCharacters.length === 2 ? (
              `${typingCharacters[0]?.name || 'Someone'} and ${typingCharacters[1]?.name || 'someone else'} are typing...`
            ) : typingCharacters && typingCharacters.length > 2 ? (
              `${typingCharacters.map(c => c?.name || 'Someone').slice(0, -1).join(', ')} and ${typingCharacters[typingCharacters.length - 1]?.name || 'someone else'} are typing...`
            ) : (
              'Someone is typing...'
            )}
          </Typography> 
        </Box>
      ) : null}
      
      <Fade in={showScrollButton}>
        <IconButton
          onClick={scrollToBottom}
          sx={{
            position: 'absolute',
            bottom: 100,
            right: 20,
            backgroundColor: 'background.paper',
            boxShadow: 3,
            '&:hover': {
              backgroundColor: 'background.paper',
            }
          }}
        >
          <KeyboardArrowDown />
        </IconButton>
      </Fade>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ 
            position: 'absolute', 
            top: 10, 
            left: '50%', 
            transform: 'translateX(-50%)',
            zIndex: 1000,
            maxWidth: '80%'
          }}
        >
          {error}
        </Alert>
      )}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', position: 'relative' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
          autoFocus
            id="chat-input"
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              
              // Only trigger typing if there's actual content
              if (e.target.value.trim().length > 0) {
                handleUserTyping();
              } else {
                // If the input is empty, clear the typing indicator
                setIsUserTyping(false);
                if (userTypingTimeoutRef.current) {
                  clearTimeout(userTypingTimeoutRef.current);
                  userTypingTimeoutRef.current = null;
                }
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isSubmitting}
            sx={{
              '&.shake': {
                animation: 'shake 0.5s',
              },
              '@keyframes shake': {
                '0%, 100%': { marginLeft: '0' },
                '10%, 30%, 50%, 70%, 90%': { marginLeft: '-5px' },
                '20%, 40%, 60%, 80%': { marginLeft: '5px' }
              }
            }}
          />
          <IconButton 
            onClick={handleSend} 
            color="primary" 
            disabled={isSubmitting}
          >
            <Send />
          </IconButton>
        </Box>
      </Box>

    </Box>
  );
}
