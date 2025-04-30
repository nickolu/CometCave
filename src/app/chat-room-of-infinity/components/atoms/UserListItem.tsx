import { ListItem, ListItemProps } from '@mui/material';

const sx = {
    listItem: {
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
    },
    
}

const UserListItem = ({children, ...props}: {children: React.ReactNode} & ListItemProps) => {
  return (
    <ListItem sx={sx.listItem} {...props}>
      {children}
    </ListItem>
  );
};

export { UserListItem }