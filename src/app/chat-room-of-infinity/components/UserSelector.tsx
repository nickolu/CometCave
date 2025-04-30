'use client';

import {
  Dialog,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  Box,
} from '@mui/material';
import { useStore } from '../store';
import { Character } from '../types';

export default function UserSelector() {
  const { isOpen, availableCharacters } = useStore((state) => state.userSelector);
  const { toggleUserSelector, toggleCustomCharacterForm, addCharacter } = useStore();

  const handleCharacterSelect = (characterId: string) => {
    const character = availableCharacters.find((c: Character) => c.id === characterId);
    if (character) {
      addCharacter(character);
      toggleUserSelector();
    }
  };

  return (
    <Dialog open={isOpen} onClose={toggleUserSelector}>
      <DialogTitle>Select a Character</DialogTitle>
      <List sx={{ minWidth: 300 }}>
        {availableCharacters.map((character: Character) => (
          <ListItem
            key={character.id}
            button
            onClick={() => handleCharacterSelect(character.id)}
          >
            <ListItemAvatar>
              <Avatar>{character.name[0]}</Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={character.name}
              secondary={character.description}
            />
          </ListItem>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            toggleUserSelector();
            toggleCustomCharacterForm();
          }}
        >
          Create Custom Character
        </Button>
      </Box>
    </Dialog>
  );
}
