'use client';

import { Box, List, IconButton, Typography, Tooltip, Button } from '@mui/material';
import { ExpandLess, ExpandMore, PersonAdd, Close } from '@mui/icons-material';
import { useStore } from '../../store';
import CharacterUserItem from '../molecules/CharacterUserItem';
import HumanUserItem from '../molecules/HumanUserItem';
import UserSelector from '../molecules/UserSelector';
import { Character } from '../../types';

const sx = {
  container: {
    position: 'relative',
  },
  drawer: (isCollapsed: boolean) => ({
    borderRight: 1,
    borderColor: 'divider',
    width: isCollapsed ? 50 : 300,
    opacity: isCollapsed ? 0 : 1,
    transition:
      'width 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms, opacity 325ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
  }),
  drawerToggle: (isCollapsed: boolean) => ({
    position: 'absolute',
    top: '36px',
    transform: 'translateY(-50%) rotate(-90deg)',
    right: isCollapsed ? '10px' : '-46px',
    transition:
      'right 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms, transform 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
    zIndex: 1,
  }),
  drawerContent: (isCollapsed: boolean) => ({
    padding: 1,
    position: 'relative',
    left: isCollapsed ? '-300px' : 0,
    transition: 'left 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
    minWidth: 300,
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 200px)',
  }),
  drawerHeader: {
    p: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: (isSelectorOpen: boolean) => ({
    bgcolor: isSelectorOpen ? 'action.selected' : 'transparent',
    '&:hover': {
      bgcolor: isSelectorOpen ? 'action.selected' : 'action.hover',
    },
  }),
  list: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: 1,
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
  },
};

export default function UserList() {
  const { userList, toggleUserList, toggleUserSelector, clearCharacters } = useStore();
  const { isCollapsed, characters } = userList;
  const { isOpen: isSelectorOpen } = useStore(state => state.userSelector);

  return (
    <Box sx={sx.container}>
      <Box sx={sx.drawerToggle(isCollapsed)}>
        <IconButton onClick={toggleUserList}>
          {isCollapsed ? <ExpandMore /> : <ExpandLess />}
        </IconButton>
      </Box>
      <Box sx={sx.drawer(isCollapsed)}>
        <Box sx={sx.drawerContent(isCollapsed)}>
          <Box sx={sx.drawerHeader}>
            <Typography variant="h6">Users</Typography>
            <Box>
              <Tooltip title={isSelectorOpen ? 'Close character selector' : 'Add new character'}>
                <IconButton
                  onClick={toggleUserSelector}
                  color={isSelectorOpen ? 'primary' : 'default'}
                  sx={sx.iconButton(isSelectorOpen)}
                >
                  {isSelectorOpen ? <Close /> : <PersonAdd />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <UserSelector />
          <List sx={sx.list}>
            <HumanUserItem />
            {characters?.length > 0 && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="overline" sx={{ px: 2 }}>
                  Characters
                </Typography>
              </Box>
            )}
            {characters?.map((character: Character) => (
              <CharacterUserItem key={character.id} character={character} />
            ))}
            {characters?.length > 0 && (
              <Box sx={{ p: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  fullWidth
                  onClick={clearCharacters}
                >
                  Clear All Characters
                </Button>
              </Box>
            )}
          </List>
        </Box>
      </Box>
    </Box>
  );
}
