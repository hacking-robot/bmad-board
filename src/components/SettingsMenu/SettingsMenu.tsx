import { useState } from 'react'
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardIcon from '@mui/icons-material/Keyboard'

export default function SettingsMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleKeyboardShortcuts = () => {
    handleClose()
    window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))
  }

  return (
    <>
      <Tooltip title="Settings">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              mt: 1
            }
          }
        }}
      >
        <MenuItem onClick={handleKeyboardShortcuts}>
          <ListItemIcon>
            <KeyboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Keyboard Shortcuts</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
