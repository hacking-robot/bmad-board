import { useState } from 'react'
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import { useStore } from '../../store'
import { AI_TOOLS, AITool } from '../../types'

export default function SettingsMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [toolDialogOpen, setToolDialogOpen] = useState(false)
  const open = Boolean(anchorEl)

  const aiTool = useStore((state) => state.aiTool)
  const setAITool = useStore((state) => state.setAITool)

  const selectedTool = AI_TOOLS.find((t) => t.id === aiTool) || AI_TOOLS[0]

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

  const handleToolSelect = () => {
    handleClose()
    setToolDialogOpen(true)
  }

  const handleToolChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAITool(event.target.value as AITool)
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
              minWidth: 220,
              mt: 1
            }
          }
        }}
      >
        <MenuItem onClick={handleToolSelect}>
          <ListItemIcon>
            <SmartToyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="AI Tool"
            secondary={selectedTool.name}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
        <MenuItem onClick={handleKeyboardShortcuts}>
          <ListItemIcon>
            <KeyboardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Keyboard Shortcuts</ListItemText>
        </MenuItem>
      </Menu>

      {/* AI Tool Selection Dialog */}
      <Dialog
        open={toolDialogOpen}
        onClose={() => setToolDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Select AI Tool
          <IconButton size="small" onClick={() => setToolDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select your AI coding assistant. This determines the command syntax shown in the BMAD Guide.
          </Typography>
          <RadioGroup value={aiTool} onChange={handleToolChange}>
            {AI_TOOLS.map((tool) => (
              <Box
                key={tool.id}
                sx={{
                  p: 1.5,
                  mb: 1,
                  border: 1,
                  borderColor: aiTool === tool.id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={() => setAITool(tool.id)}
              >
                <FormControlLabel
                  value={tool.id}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={500}>{tool.name}</Typography>
                        <Chip
                          label={`${tool.agentPrefix}agent`}
                          size="small"
                          sx={{
                            fontFamily: 'monospace',
                            height: 20,
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {tool.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Box>
            ))}
          </RadioGroup>
        </DialogContent>
      </Dialog>
    </>
  )
}
