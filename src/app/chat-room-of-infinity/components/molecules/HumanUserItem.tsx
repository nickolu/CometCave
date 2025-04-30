'use client';

import { useState } from 'react';
import { ListItemText, ListItemAvatar, Avatar, Box, Tooltip } from '@mui/material';
import { green, orange, red, grey } from '@mui/material/colors';
import { useStore } from '../../store';
import { UserListItem } from '../atoms/UserListItem';
import UserProfileDialog from './UserProfileDialog';

export default function HumanUserItem() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const humanUser = useStore((state) => state.userList.humanUser);

  return (
    <>
      <UserListItem 
        onClick={() => setIsProfileOpen(true)}
        sx={{
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
      >
        <ListItemAvatar>
          <Avatar>{humanUser.name[0]}</Avatar>
        </ListItemAvatar>
        <ListItemText primary={humanUser.name} />
        <Tooltip title={humanUser.status}>
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
              }[humanUser.status],
            }}
          />
        </Tooltip>
      </UserListItem>
      <UserProfileDialog
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
