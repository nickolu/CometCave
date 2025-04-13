'use client';

import { Box, TextField, IconButton, Typography, Fade, Menu, MenuItem, Alert, Snackbar } from '@mui/material';
import { Send, KeyboardArrowDown, MoreVert, DeleteOutline } from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import Message from './ChatMessage';
import { ChatMessage } from '../types';
import { useSafetyCheck } from '../api/hooks';

export default function Chat() {
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const { messages, isTyping } = useStore((state) => state.chat);
  const sendMessage = useStore((state) => state.sendMessage);
  const resetChat = useStore((state) => state.resetChat);
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
  const safetyCheck = useSafetyCheck();

  const handleSend = async () => {
    if (input.trim()) {
      try {
        const result = await safetyCheck.mutateAsync(input.trim());

        if (result.safe) {
          sendMessage(input.trim());
          setInput('');
          scrollToBottom();
        } else {
          setError(result.reason);
        }
      } catch {
        setError('Failed to check message safety');
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
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
          />
          <IconButton onClick={handleSend} color="primary">
            <Send />
          </IconButton>
        </Box>
      </Box>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
