'use client';

import { Box, TextField, IconButton, Typography } from '@mui/material';
import { Send } from '@mui/icons-material';
import { useState } from 'react';
import { useStore } from '../store';
import Message from './ChatMessage';
import { ChatMessage } from '../types';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, isTyping } = useStore((state) => state.chat);
  const sendMessage = useStore((state) => state.sendMessage);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '80%' }}>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((message: ChatMessage) => (
          <Message key={message.id} message={message} />
        ))}
        {isTyping && (
          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1 }}>
            Someone is typing...
          </Typography>
        )}
      </Box>
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
    </Box>
  );
}
