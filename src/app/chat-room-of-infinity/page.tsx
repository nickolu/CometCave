
'use client';

import { Box } from '@mui/material';
import { GamePageTemplate } from "../components/page-templates/GamePageTemplate";
import UserList from './components/UserList';
import Chat from './components/Chat';
import UserSelector from './components/UserSelector';
import CustomCharacterForm from './components/CustomCharacterForm';

export default function ChatRoomOfInfinity() {
  return (
    <GamePageTemplate title="Chat Room of Infinity">
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <UserList />
        <Chat />
        <UserSelector />
        <CustomCharacterForm />
      </Box>
    </GamePageTemplate>
  );
}
