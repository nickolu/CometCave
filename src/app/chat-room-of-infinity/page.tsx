'use client';

import { Box, Divider } from '@mui/material';
import dynamic from 'next/dynamic';
import { QueryProvider } from './providers/QueryProvider';
import Link from 'next/link';

const UserList = dynamic(() => import('./components/organisims/UserList'), {
  ssr: false,
});

const Chat = dynamic(() => import('./components/organisims/Chat'), {
  ssr: false,
});

export default function ChatRoomOfInfinity() {
  return (
    <QueryProvider>
      <div className="max-w-3xl mx-auto py-12">
        <Link href="/" className="text-cream-white/80 hover:text-cream-white mb-6 inline-block">
          &larr; Back to games
        </Link>

        <div className="bg-space-dark rounded-2xl p-8 shadow-lg border border-space-purple/20">
          <h1 className="text-3xl font-bold text-center mb-4 text-cream-white">CHAT ROOM</h1>
          <p className="text-center text-slate-400 mb-8">Chat with fictional characters in a chat room!</p>

        
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
        </div>
      </div>
    </QueryProvider>
  );
}
