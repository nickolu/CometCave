'use client';

import { ListItemText, ListItemAvatar, Avatar, IconButton, Box, Tooltip } from '@mui/material';
import { Close } from '@mui/icons-material';
import { green} from '@mui/material/colors';
import { Character } from '../../types';
import { useStore } from '../../store';
import { UserListItem } from '../atoms/UserListItem';

interface Props {
  character: Character;
}

export default function CharacterUserItem({ character }: Props) {
  const removeCharacter = useStore((state) => state.removeCharacter);

  return (
    <UserListItem
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
          sx={{ maxWidth: '140px', '& p': { fontSize: '0.750rem' } }}
        />
        <Tooltip title="Online">
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: green[500],
            }}
          />
        </Tooltip>
      </Box>
    </UserListItem>
  );
}
