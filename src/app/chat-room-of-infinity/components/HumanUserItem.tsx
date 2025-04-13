'use client';

import { useState } from 'react';
import { 
  ListItemText, 
  ListItemAvatar, 
  Avatar, 
  Box,
  Menu,
  MenuItem,
  TextField
} from '@mui/material';
import { useStore } from '../store';
import { CharacterStatus } from '../types';
import { UserListItem } from './atoms/UserListItem';

export default function HumanUserItem() {
  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const humanUser = useStore((state) => state.userList.humanUser) || { name: 'You', status: 'online' };
  const updateHumanUser = useStore((state) => state.updateHumanUser);

  const handleStatusClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setStatusAnchor(event.currentTarget);
  };

  const handleStatusClose = () => {
    setStatusAnchor(null);
  };

  const handleStatusSelect = (status: CharacterStatus) => {
    updateHumanUser({ status });
    handleStatusClose();
  };

  const handleNameEdit = () => {
    setEditName(humanUser.name);
    setIsEditing(true);
  };

  const handleNameSave = () => {
    if (editName.trim()) {
      updateHumanUser({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <>
      <UserListItem>
        <ListItemAvatar>
          <Avatar>{humanUser.name?.charAt(0) || '?'}</Avatar>
        </ListItemAvatar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isEditing ? (
                  <TextField
                    autoFocus
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'transparent',
                        },
                        '&:hover fieldset': {
                          borderColor: 'transparent',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                ) : (
                  <Box 
                    onClick={handleNameEdit}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    {humanUser.name}
                  </Box>
                )}
              </Box>
            }
          />
          <Box
            onClick={handleStatusClick}
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: {
                online: 'success.main',
                away: 'warning.main',
                busy: 'error.main',
                offline: 'text.disabled'
              }[humanUser.status],
              cursor: 'pointer'
            }}
          />
        </Box>
      </UserListItem>
      <Menu
        anchorEl={statusAnchor}
        open={Boolean(statusAnchor)}
        onClose={handleStatusClose}
      >
        <MenuItem onClick={() => handleStatusSelect('online')}>Online</MenuItem>
        <MenuItem onClick={() => handleStatusSelect('away')}>Away</MenuItem>
        <MenuItem onClick={() => handleStatusSelect('busy')}>Busy</MenuItem>
        <MenuItem onClick={() => handleStatusSelect('offline')}>Offline</MenuItem>
      </Menu>
    </>
  );
}
