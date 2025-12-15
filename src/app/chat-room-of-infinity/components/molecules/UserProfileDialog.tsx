import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { FormEvent, useState } from 'react'

import { useStore } from '../../store'
import { CharacterStatus, HumanUser } from '../../types'

interface UserProfileDialogProps {
  open: boolean
  onClose: () => void
}

export default function UserProfileDialog({ open, onClose }: UserProfileDialogProps) {
  const humanUser = useStore(state => state.userList.humanUser)
  const updateHumanUser = useStore(state => state.updateHumanUser)

  const [formData, setFormData] = useState<HumanUser>({
    name: humanUser.name,
    status: humanUser.status,
    description: humanUser.description || '',
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    updateHumanUser({
      name: formData.name,
      status: formData.status,
      description: formData.description,
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Profile
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description || ''}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={e =>
                setFormData({ ...formData, status: e.target.value as CharacterStatus })
              }
            >
              <MenuItem value="online">Online</MenuItem>
              <MenuItem value="away">Away</MenuItem>
              <MenuItem value="busy">Busy</MenuItem>
              <MenuItem value="offline">Offline</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
