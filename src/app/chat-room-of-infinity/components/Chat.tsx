'use client';

import { Box, TextField, IconButton, Typography, Fade, Menu, MenuItem, Alert } from '@mui/material';
import { Send, KeyboardArrowDown, MoreVert, DeleteOutline } from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import Message from './ChatMessage';
import { ChatMessage } from '../types';
import { useSafetyCheck, useConversationManager, useCharacterResponse } from '../api/hooks';

export default function Chat() {
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const { messages, typingCharacters } = useStore((state) => state.chat);
  const sendMessage = useStore((state) => state.sendMessage);
  const addCharacterMessage = useStore((state) => state.addCharacterMessage);
  const removeTypingCharacter = useStore((state) => state.removeTypingCharacter);
  const setTypingCharacters = useStore((state) => state.setTypingCharacters);
  const resetChat = useStore((state) => state.resetChat);
  const characters = useStore((state) => state.userList.characters);
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

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const safetyCheck = useSafetyCheck();
  const conversationManager = useConversationManager();
  const characterResponse = useCharacterResponse();

  const handleSend = async () => {
    if (input.trim()) {
      setIsSubmitting(true);
      try {
        const result = await safetyCheck.mutateAsync(input.trim());

        if (result.safe) {
          const messageText = input.trim();
          sendMessage(messageText);
          setInput('');
          scrollToBottom();
          
          // After sending a message, get characters that should respond
          handleGetCharacterResponses(messageText);
        } else {
          setError(result.reason);
          // Vibrate the input field
          const inputEl = document.getElementById('chat-input');
          inputEl?.classList.add('shake');
          setTimeout(() => inputEl?.classList.remove('shake'), 500);
        }
      } catch {
        setError('Failed to check message safety');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add some sample characters if none exist
  useEffect(() => {
    if (!characters || characters.length === 0) {
      console.log('No characters found, adding sample characters');
      // Import sample characters
      import('../sampleCharacters.json').then(sampleChars => {
        // Add first 3 sample characters
        const samplesToAdd = sampleChars.default.slice(0, 3);
        samplesToAdd.forEach(char => {
          useStore.getState().addCharacter(char);
        });
        console.log('Added sample characters:', samplesToAdd);
      });
    }
  }, [characters]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle getting responses from characters
  const handleGetCharacterResponses = async (messageText: string) => {
    try {
      console.log('📨 Getting character responses for:', messageText);
      console.log('Available characters:', characters);
      
      // Get all chat messages for context
      const chatMessages = [...messages, {
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
        return;
      }

      // Get characters who should respond
      const result = await conversationManager.mutateAsync({ 
        chatMessages, 
        characters 
      });
      
      console.log('🎭 Characters who will respond:', result.respondingCharacters);
      
      // Add a slight delay for realism
      setTimeout(() => {
        console.log(result.respondingCharacters)
        // Set all responding characters as typing
        if (result.respondingCharacters && result.respondingCharacters.length > 0) {
          setTypingCharacters(result.respondingCharacters);
        } else {
          setTypingCharacters([]);
        }
        
        // For each responding character, get their response
        if (!result.respondingCharacters || result.respondingCharacters.length === 0) {
          console.log('No characters selected to respond!');
          return;
        }
        
        result.respondingCharacters.forEach(async (character, index) => {
          try {
            setTimeout(async () => {
              console.log(`💬 Requesting response from ${character.name}...`);  
              try {
                const characterResult = await characterResponse.mutateAsync({ 
                  character, 
                  chatMessages 
                });
                
                console.log(`🗣️ ${character.name} responds:`, characterResult.response);
                addCharacterMessage(character, characterResult.response);
              } catch (responseError) {
                console.error(`Error getting response from ${character.name}:`, responseError)                // Add a fallback message
                const fallbackResponses = [
                  `I'm not sure what to say about that.`,
                  `That's interesting. Tell me more.`,
                  `I'm thinking about how to respond to that.`,
                  `I'd like to hear more about your perspective.`
                ];
                const fallbackResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
                addCharacterMessage(character, fallbackResponse);
              }
              
              removeTypingCharacter(character.id);
            }, 0);
          } catch (error) {
            console.error(`Error getting response from ${character.name}:`, error);
          }
        });
        
        // If no characters are responding, make sure typing indicator is off
        if (result.respondingCharacters.length === 0) {
          setTypingCharacters([]);
        }
      }, 0);
      
    } catch (error) {
      console.error('Error in conversation flow:', error);
      setTypingCharacters([]);
    }
  };
  
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
        </Menu>
      </Box>
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
        {[...messages].reverse().map((message: ChatMessage) => (
          <Message key={message.id} message={message} />
        ))}

      </Box>
      
      {typingCharacters && typingCharacters.length > 0 && (
        <Box p={2}>    
          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1 }}>
            {typingCharacters && typingCharacters.length === 1 
              ? `${typingCharacters[0]?.name || 'Someone'} is typing...` 
              : typingCharacters && typingCharacters.length === 2 
                ? `${typingCharacters[0]?.name || 'Someone'} and ${typingCharacters[1]?.name || 'someone else'} are typing...` 
                : typingCharacters && typingCharacters.length > 2
                  ? `${typingCharacters.map(c => c?.name || 'Someone').slice(0, -1).join(', ')} and ${typingCharacters[typingCharacters.length - 1]?.name || 'someone else'} are typing...`
                  : 'Someone is typing...'
            }
          </Typography> 
        </Box>
      )}
      
      <Fade in={showScrollButton}>
        <IconButton
          onClick={scrollToBottom}
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 80,
            backgroundColor: 'background.paper',
            boxShadow: 2,
            zIndex: 1,
            '&:hover': {
              backgroundColor: 'action.hover'
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
            bottom: '100%', 
            left: '50%', 
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '600px',
            mb: 1,
            boxShadow: 2,
            '& .MuiAlert-message': {
              display: 'flex',
              alignItems: 'center'
            }
          }}
        >
          {error}
        </Alert>
      )}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', position: 'relative' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            id="chat-input"
            fullWidth
            size="small"
            autoComplete="off"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            error={!!error}
            disabled={isSubmitting}
            sx={{
              bgcolor: 'background.paper',
              '&.shake': {
                animation: 'shake 0.5s',
                animationIterationCount: '1'
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
