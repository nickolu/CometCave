'use client';

import { Box, Divider } from '@mui/material';
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
      <Divider />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 180px)' }}>
        <UserList />
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'margin-left 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
        }}>
          <Chat />
        </Box>
      </Box>
    </GamePageTemplate>
  );
}
