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
  const { messages, isTyping } = useStore((state) => state.chat);
  const sendMessage = useStore((state) => state.sendMessage);
  const addCharacterMessage = useStore((state) => state.addCharacterMessage);
  const setIsTyping = useStore((state) => state.setIsTyping);
  const resetChat = useStore((state) => state.resetChat);
  const characters = useStore((state) => state.userSelector.availableCharacters);
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
      
      // Get characters who should respond
      const result = await conversationManager.mutateAsync({ 
        chatMessages, 
        characters 
      });
      
      console.log('🎭 Characters who will respond:', result.respondingCharacters);
      
      // Add a slight delay for realism
      setTimeout(() => {
        // For each responding character, get their response
        result.respondingCharacters.forEach(async (character, index) => {
          try {
            // Add a staggered delay for each character response
            setTimeout(async () => {
              // Get the character's response
              const characterResult = await characterResponse.mutateAsync({ 
                character, 
                chatMessages 
              });
              
              console.log(`🗣️ ${character.name} responds:`, characterResult.response);
              
              // Add the character's message to the chat
              addCharacterMessage(character, characterResult.response);
              
              // If this is the last character, stop typing indicator
              if (index === result.respondingCharacters.length - 1) {
                setIsTyping(false);
              }
            }, index * 2000); // Stagger responses by 2 seconds each
          } catch (error) {
            console.error(`Error getting response from ${character.name}:`, error);
          }
        });
        
        // If no characters are responding, stop typing indicator
        if (result.respondingCharacters.length === 0) {
          setIsTyping(false);
        }
      }, 1000); // Wait 1 second before characters start responding
      
    } catch (error) {
      console.error('Error in conversation flow:', error);
      setIsTyping(false);
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
        {isTyping && (
          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1 }}>
            Someone is typing...
          </Typography>
        )}
      </Box>
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
