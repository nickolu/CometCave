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
  const { messages, typingCharacters, remainingCharacterMessages } = useStore((state) => state.chat);
  const incrementRemainingCharacterMessages = useStore((state) => state.incrementRemainingCharacterMessages);
  const toggleCharactersRespondToEachOther = useStore((state) => state.toggleCharactersRespondToEachOther);
  const charactersRespondToEachOther = useStore((state) => state.chat.charactersRespondToEachOther);

  // Effects for scroll and character response timer
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Chain character responses only when appropriate
  useEffect(() => {
    if (!charactersRespondToEachOther) return;
    if (isUserTyping) return;
    if (!messages || messages.length === 0) return;
    if (remainingCharacterMessages <= 0) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage.character || lastMessage.character.id === 'user') return;
    const timeout = setTimeout(() => {
      handleGetCharacterResponses(
        lastMessage.message,
        `${lastMessage.id}-auto-${Date.now()}`
      );
    }, CHARACTER_RESPONSE_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [charactersRespondToEachOther, isUserTyping, messages, remainingCharacterMessages, handleGetCharacterResponses]);


  // Handler to override the limit and allow another round
  const handleOverrideLimit = () => {
    incrementRemainingCharacterMessages(4);
    setTimeout(() => {
      if (messages && messages.length > 0) {
        const lastCharacterMessage = [...messages].reverse().find(msg => msg.character && msg.character.id !== 'user');
        if (lastCharacterMessage) {
          // Pass a unique messageId to force character response
          handleGetCharacterResponses(
            lastCharacterMessage.message,
            `${lastCharacterMessage.id}-resume-${Date.now()}`
          );
        }
      }
    }, 50);
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
       {/* Show message if character response limit is reached */}
       {/* Only show after the last character message is rendered, not before */}
      {remainingCharacterMessages === 0 && messages && Array.isArray(messages) && messages.length > 0 && messages[messages.length - 1]?.character?.id !== 'user' && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          py: 1, px: 2, mb: 1, background: 'rgba(0,0,0,0.03)', borderRadius: 2, border: '1px solid #eee',
          fontSize: '0.92rem', color: 'text.secondary', position: 'relative'
        }}>
          <Typography variant="body2" sx={{ fontSize: '0.97rem', color: 'text.secondary', mr: 1 }}>
            The characters are waiting for you to respond.
          </Typography>
          <button
            onClick={handleOverrideLimit}
            style={{
              background: 'none',
              border: 'none',
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '0.97rem',
              textDecoration: 'underline',
              padding: 0,
              margin: 0,
              marginLeft: 8,
              fontWeight: 500,
            }}
          >
            (Let them keep chatting)
          </button>
        </Box>
      )}
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
