'use client';

import { Box, TextField, IconButton, Typography, Fade, Menu, MenuItem, Alert, Switch, FormControlLabel } from '@mui/material';
import { Send, KeyboardArrowDown, MoreVert, DeleteOutline } from '@mui/icons-material';
import { useRef, useEffect } from 'react';
import { useChatInput } from '../../hooks/useChatInput';
import { useCharacterResponses } from '../../hooks/useCharacterResponses';
import { useChatScroll } from '../../hooks/useChatScroll';
import { useChatMenu } from '../../hooks/useChatMenu';
import { useChatSafety } from '../../hooks/useChatSafety';
import { useStore } from '../../store';
import Message from '../molecules/ChatMessage';
import { ChatMessage } from '../../types';

// Constants for timing values (in milliseconds)
const CHARACTER_RESPONSE_INTERVAL_MS = 2000; // ms between character responses

export default function Chat() {
  // Character response timer ref for menu reset
  const characterResponseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Character response logic
  const {
    handleGetCharacterResponses,
  } = useCharacterResponses();

  // Menu logic
  const {
    menuAnchor,
    handleMenuOpen,
    handleMenuClose,
    handleReset
  } = useChatMenu({ characterResponseTimerRef });

  // Scroll logic
  const {
    showScrollButton,
    messagesEndRef,
    messageContainerRef,
    scrollToBottom,
    handleScroll
  } = useChatScroll();

  // Safety logic
  const { error, setError } = useChatSafety();

  // Chat input logic
  const {
    input,
    isUserTyping,
    isSubmitting,
    handleInputChange,
    handleKeyPress,
    handleSend,
  } = useChatInput({
    onMessageSent: () => {},
    scrollToBottom,
    handleGetCharacterResponses
  });

  // Zustand store
  const { messages, typingCharacters } = useStore((state) => state.chat);
  const toggleCharactersRespondToEachOther = useStore((state) => state.toggleCharactersRespondToEachOther);
  const charactersRespondToEachOther = useStore((state) => state.chat.charactersRespondToEachOther);

  // Effects for scroll and character response timer
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Timer for characters responding to each other
  useEffect(() => {
    if (characterResponseTimerRef.current) {
      clearInterval(characterResponseTimerRef.current);
      characterResponseTimerRef.current = null;
    }
    let debounceTimeout: NodeJS.Timeout | null = null;
    if (charactersRespondToEachOther && !isUserTyping) {
      debounceTimeout = setTimeout(() => {
        characterResponseTimerRef.current = setInterval(() => {
          if (messages && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            handleGetCharacterResponses(lastMessage.message, lastMessage.id);
          }
        }, CHARACTER_RESPONSE_INTERVAL_MS);
      }, 1500); // 1.5s debounce after user stops typing
    }
    return () => {
      if (characterResponseTimerRef.current) {
        clearInterval(characterResponseTimerRef.current);
        characterResponseTimerRef.current = null;
      }
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [charactersRespondToEachOther, messages, handleGetCharacterResponses, isUserTyping]);

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
            onChange={handleInputChange}
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
