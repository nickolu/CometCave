'use client';

import { Box, Typography, Avatar } from '@mui/material';
import { ChatMessage as ChatMessageType } from '../types';

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isSelf = message.character.id === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isSelf ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      {!isSelf && (
        <Avatar sx={{ mr: 1 }}>{message.character.name[0]}</Avatar>
      )}
      <Box
        sx={{
          maxWidth: '70%',
          backgroundColor: isSelf ? 'primary.main' : 'secondary.main',
          color: isSelf ? 'white' : 'text.primary',
          borderRadius: 2,
          p: 2,
        }}
      >
        {!isSelf && (
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {message.character.name}
          </Typography>
        )}
        <Typography variant="body1">{message.message}</Typography>
      </Box>
      {isSelf && (
        <Avatar sx={{ ml: 1 }}>{message.character.name[0]}</Avatar>
      )}
    </Box>
  );
}
