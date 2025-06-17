'use client';

import { Box, Container, Typography } from '@mui/material';
import { Navigation } from "../navigation";

const GamePageTemplate = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <Box
      sx={{
        background: 'linear-gradient(180deg, rgb(17, 24, 39) 0%, rgb(49, 46, 129) 100%)',
        height: '100vh'
      }}
    >
      <Navigation />
      <Container
        sx={{
          pt: 4,
        }}
        
        width="100%"
        maxWidth="100%"
      >
        <Typography
          variant="h1"
          sx={{
            mb: 4,
            background: 'linear-gradient(90deg, #42a5f5 0%, #ab47bc 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontWeight: 'bold'
          }}
        >
          {title}
        </Typography>
        {children}
      </Container>
    </Box>
  );
};

export { GamePageTemplate };