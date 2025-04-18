'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useStore } from '../../store';
import { FormEvent, ChangeEvent } from 'react';

export default function CustomCharacterForm() {
  const { isOpen, name, description } = useStore((state) => state.customCharacterForm);
  const { toggleCustomCharacterForm, updateCustomCharacterForm, saveCustomCharacter } = useStore();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveCustomCharacter();
  };

  return (
    <Dialog open={isOpen} onClose={toggleCustomCharacterForm}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Custom Character</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => 
              updateCustomCharacterForm({ name: e.target.value })
            }
            required
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => 
              updateCustomCharacterForm({ description: e.target.value })
            }
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={toggleCustomCharacterForm}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
