"use client";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/theme';
import { useState } from 'react';
import { EmotionSSRProvider } from '@/app/emotion-ssr-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <EmotionSSRProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </EmotionSSRProvider>
    </QueryClientProvider>
  );
}
