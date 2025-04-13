'use client';

import { Box, List, IconButton, Typography, Tooltip } from '@mui/material';
import { ExpandLess, ExpandMore, PersonAdd, Close } from '@mui/icons-material';
import { useStore } from '../store';
import UserListItem from './UserListItem';
import HumanUserItem from './HumanUserItem';
import UserSelector from './UserSelector';
import { Character } from '../types';

export default function UserList() {
  const { userList, toggleUserList, toggleUserSelector } = useStore();
  const { isCollapsed, characters } = userList;
  const { isOpen: isSelectorOpen } = useStore((state) => state.userSelector);

  return (
    <Box sx={{ width: 250, borderRight: 1, borderColor: 'divider' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Characters</Typography>
        <Box>
          <Tooltip title={isSelectorOpen ? "Close character selector" : "Add new character"}>
            <IconButton 
              onClick={toggleUserSelector}
              color={isSelectorOpen ? "primary" : "default"}
              sx={{
                bgcolor: isSelectorOpen ? 'action.selected' : 'transparent',
                '&:hover': {
                  bgcolor: isSelectorOpen ? 'action.selected' : 'action.hover'
                }
              }}
            >
              {isSelectorOpen ? <Close /> : <PersonAdd />}
            </IconButton>
          </Tooltip>
          <IconButton onClick={toggleUserList}>
            {isCollapsed ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Box>
      </Box>
      {!isCollapsed && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
          <UserSelector />
          <List sx={{ 
            flexGrow: 1, 
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'action.hover',
              borderRadius: '4px',
            },
          }}>
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
        </Box>
      )}
    </Box>
  );
}
