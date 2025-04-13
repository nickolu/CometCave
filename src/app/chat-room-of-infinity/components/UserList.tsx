'use client';

import { Box, List, IconButton, Typography } from '@mui/material';
import { ExpandLess, ExpandMore, PersonAdd } from '@mui/icons-material';
import { useStore } from '../store';
import UserListItem from './UserListItem';
import HumanUserItem from './HumanUserItem';
import { Character } from '../types';

export default function UserList() {
  const { userList, toggleUserList, toggleUserSelector } = useStore();
  const { isCollapsed, characters } = userList;

  return (
    <Box sx={{ width: 250, borderRight: 1, borderColor: 'divider' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Characters</Typography>
        <Box>
          <IconButton onClick={toggleUserSelector}>
            <PersonAdd />
          </IconButton>
          <IconButton onClick={toggleUserList}>
            {isCollapsed ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Box>
      </Box>
      {!isCollapsed && (
        <List>
          <HumanUserItem />
          {characters.length > 0 && (
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="overline" sx={{ px: 2 }}>
                Characters
              </Typography>
            </Box>
          )}
          {characters.map((character: Character) => (
            <UserListItem key={character.id} character={character} />
          ))}
        </List>
      )}
    </Box>
  );
}
