'use client';

import { useState, FormEvent, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  Box,
  TextField,
  Typography,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useStore } from '../../store';
import { Character } from '../../types';

export default function UserSelector() {
  const { isOpen, availableCharacters }  = useStore((state) => state.userSelector);
  const { characters: selectedCharacters } = useStore((state) => state.userList);
  const { name, description } = useStore((state) => state.customCharacterForm);
  const { 
    toggleUserSelector, 
    addCharacter,
    updateCustomCharacterForm,
    saveCustomCharacter,
    loadSampleCharacters
  } = useStore();
  
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [showGenerateForm, setShowGenerateForm] = useState(false);

  // Load sample characters when the component mounts
  useEffect(() => {
    if (availableCharacters.length === 0) {
      loadSampleCharacters();
    }
  }, [availableCharacters.length, loadSampleCharacters]);

  // Filter out characters that are already in the user list
  const filteredAvailableCharacters = availableCharacters.filter(
    (c: Character) => !selectedCharacters.some((selected: Character) => selected.id === c.id)
  );

  const handleCharacterSelect = (characterId: string) => {
    const character = filteredAvailableCharacters.find((c: Character) => c.id === characterId);
    console.log('Selected character:', character);
    console.log(characterId);
    if (character) {
      addCharacter(character);
      toggleUserSelector();
    }
  };

  const handleGenerateMore = () => {
    // TODO: Implement character generation
    console.log('Generating with prompt:', generationPrompt);
  };

  const handleCustomSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveCustomCharacter();
    toggleUserSelector();
  };

  const handleCustomCancel = () => {
    updateCustomCharacterForm({ name: '', description: '' });
  };

  if (!isOpen) return null;

  return (
    <Dialog 
      open={isOpen} 
      onClose={toggleUserSelector}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Select Character
        <IconButton
          onClick={toggleUserSelector}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '80vh' }}>
        <List sx={{ 
          maxHeight: '30vh',
          overflowY: 'scroll',
          bgcolor: 'background.paper',
          borderRadius: 1,
          mb: 2
        }}>
          {filteredAvailableCharacters.map((character: Character) => (
            <ListItem
              key={character.id}
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
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

        <Box sx={{ mt: 2 }}>
          <Collapse in={showGenerateForm}>
            <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Generate More
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Optional prompt for character generation"
                  value={generationPrompt}
                  onChange={(e) => setGenerationPrompt(e.target.value)}
                  sx={{
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused': {
                        bgcolor: 'background.paper'
                      }
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => {
                    handleGenerateMore();
                    setShowGenerateForm(false);
                  }}
                >
                  Generate
                </Button>
              </Box>
            </Box>
          </Collapse>
          {!showGenerateForm && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setShowGenerateForm(true)}
            >
              Generate More Characters
            </Button>
          )}
        </Box>

        <Box sx={{ mt: 2, bgcolor: 'background.paper', borderRadius: 1, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add Custom Character
          </Typography>
          <form onSubmit={handleCustomSubmit}>
            <TextField
              autoFocus
              size="small"
              label="Name"
              fullWidth
              value={name}
              onChange={(e) => updateCustomCharacterForm({ name: e.target.value })}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              size="small"
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => updateCustomCharacterForm({ description: e.target.value })}
              required
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={handleCustomCancel}>
                Clear
              </Button>
              <Button type="submit" variant="contained">
                Add
              </Button>
            </Box>
          </form>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
