'use client';

import { ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Box, Tooltip } from '@mui/material';
import { Close } from '@mui/icons-material';
import { green, orange, red, grey } from '@mui/material/colors';
import { Character } from '../types';
import { useStore } from '../store';

interface Props {
  character: Character;
}

export default function UserListItem({ character }: Props) {
  const removeCharacter = useStore((state) => state.removeCharacter);

  return (
    <ListItem
      secondaryAction={
        <IconButton edge="end" onClick={() => removeCharacter(character.id)}>
          <Close />
        </IconButton>
      }
    >
      <ListItemAvatar>
        <Avatar>{character.name[0]}</Avatar>
      </ListItemAvatar>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <ListItemText
          primary={character.name}
          secondary={character.description}
        />
        <Tooltip title={character.status}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: {
                online: green[500],
                away: orange[500],
                busy: red[500],
                offline: grey[500]
              }[character.status],
            }}
          />
        </Tooltip>
      </Box>
    </ListItem>
  );
}
