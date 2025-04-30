'use client';

import { ListItem, ListItemText, ListItemAvatar, Avatar, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
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
      <ListItemText
        primary={character.name}
        secondary={character.description}
      />
    </ListItem>
  );
}
