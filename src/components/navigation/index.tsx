'use client';

import { AppBar, Toolbar, Button, Box } from '@mui/material';
import Link from 'next/link';

const sx = {
  appBar: {
    backgroundColor: 'transparent', 
    padding: 0, 
    borderBottom: 1,
    borderColor: 'divider',
  }
}
export function Navigation() {
  return (
    <AppBar position="static" color="transparent" elevation={0} sx={sx.appBar}>
      <Toolbar sx={{ justifyContent: 'center', padding: 0, m: 0}}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
          <Button
            component={Link}
            href="/"
            color="primary"
            variant="text"
          >
            Home
          </Button>
          <Button
            component={Link}
            href="/ring-toss"
            color="primary"
            variant="text"
          >
            Ring Toss
          </Button>
          <Button
            component={Link}
            href="/chat-room-of-infinity"
            color="primary"
            variant="text"
          >
            Chat Room of Infinity
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}