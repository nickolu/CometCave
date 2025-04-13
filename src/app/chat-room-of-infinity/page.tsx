'use client';

import { Box } from '@mui/material';
import dynamic from 'next/dynamic';
import { GamePageTemplate } from "../components/page-templates/GamePageTemplate";

const UserList = dynamic(() => import('./components/UserList'), {
  ssr: false,
});

const Chat = dynamic(() => import('./components/Chat'), {
  ssr: false,
});

export default function ChatRoomOfInfinity() {
  return (
    <GamePageTemplate title="Chat Room of Infinity">
      <Box sx={{ display: 'flex', height: 'calc(100vh - 140px)' }}>
        <UserList />
        <Chat />
      </Box>
    </GamePageTemplate>
  );
}
