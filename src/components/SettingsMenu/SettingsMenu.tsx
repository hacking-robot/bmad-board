import { useState, useEffect } from 'react'
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
  Chip,
  Switch,
  Slider,
  CircularProgress
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import NotificationsIcon from '@mui/icons-material/Notifications'
import RateReviewIcon from '@mui/icons-material/RateReview'
import ChatIcon from '@mui/icons-material/Chat'
import GitIcon from '@mui/icons-material/AccountTree'
import MergeIcon from '@mui/icons-material/Merge'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import { useStore } from '../../store'
import { AI_TOOLS, AITool, CLIDetectionResult } from '../../types'

export default function SettingsMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [toolDialogOpen, setToolDialogOpen] = useState(false)
  const [chatSettingsDialogOpen, setChatSettingsDialogOpen] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [cliStatus, setCliStatus] = useState<Record<string, CLIDetectionResult>>({})
  const [detectingCli, setDetectingCli] = useState(false)
  const open = Boolean(anchorEl)

  const aiTool = useStore((state) => state.aiTool)
  const setAITool = useStore((state) => state.setAITool)
  const notificationsEnabled = useStore((state) => state.notificationsEnabled)
  const setNotificationsEnabled = useStore((state) => state.setNotificationsEnabled)
  const enableHumanReviewColumn = useStore((state) => state.enableHumanReviewColumn)
  const setEnableHumanReviewColumn = useStore((state) => state.setEnableHumanReviewColumn)
  const maxThreadMessages = useStore((state) => state.maxThreadMessages)
  const setMaxThreadMessages = useStore((state) => state.setMaxThreadMessages)
  const principalBranch = useStore((state) => state.principalBranch)
  const setPrincipalBranch = useStore((state) => state.setPrincipalBranch)
  const allowDirectEpicMerge = useStore((state) => state.allowDirectEpicMerge)
  const setAllowDirectEpicMerge = useStore((state) => state.setAllowDirectEpicMerge)

  const selectedTool = AI_TOOLS.find((t) => t.id === aiTool) || AI_TOOLS[0]

  // Detect CLI tools when dialog opens
  useEffect(() => {
    if (toolDialogOpen && Object.keys(cliStatus).length === 0) {
      detectCliTools()
    }
  }, [toolDialogOpen])

  const detectCliTools = async () => {
    setDetectingCli(true)
    try {
      const results = await window.cliAPI.detectAllTools()
      setCliStatus(results)
    } catch (error) {
      console.error('Failed to detect CLI tools:', error)
    } finally {
      setDetectingCli(false)
    }
  }

  const refreshCliDetection = async () => {
    setDetectingCli(true)
    try {
      await window.cliAPI.clearCache()
      const results = await window.cliAPI.detectAllTools()
      setCliStatus(results)
    } catch (error) {
      console.error('Failed to refresh CLI detection:', error)
    } finally {
      setDetectingCli(false)
    }
  }

  const handleChatSettingsClick = () => {
    handleClose()
    setChatSettingsDialogOpen(true)
  }

  const handleBranchSettingsClick = () => {
    handleClose()
    setBranchDialogOpen(true)
  }

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
        <MenuItem onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
          <ListItemIcon>
            <NotificationsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Notifications"
            secondary="Story status changes"
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          <Switch
            edge="end"
            checked={notificationsEnabled}
            size="small"
          />
        </MenuItem>
        <MenuItem onClick={() => setEnableHumanReviewColumn(!enableHumanReviewColumn)}>
          <ListItemIcon>
            <RateReviewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Human Review Column"
            secondary="Review checklist step"
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          <Switch
            edge="end"
            checked={enableHumanReviewColumn}
            size="small"
          />
        </MenuItem>
        <MenuItem onClick={handleChatSettingsClick}>
          <ListItemIcon>
            <ChatIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Chat Settings"
            secondary={`Max ${maxThreadMessages} messages`}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
        <MenuItem onClick={handleBranchSettingsClick}>
          <ListItemIcon>
            <GitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Principal Branch"
            secondary={principalBranch}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
        <MenuItem onClick={() => setAllowDirectEpicMerge(!allowDirectEpicMerge)}>
          <ListItemIcon>
            <MergeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Direct Epic Merge"
            secondary="Merge without PR"
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          <Switch
            edge="end"
            checked={allowDirectEpicMerge}
            size="small"
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh CLI detection">
              <IconButton 
                size="small" 
                onClick={refreshCliDetection}
                disabled={detectingCli}
              >
                {detectingCli ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setToolDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select your AI coding assistant. This determines the command syntax shown in the BMAD Guide.
          </Typography>
          <RadioGroup value={aiTool} onChange={handleToolChange}>
            {AI_TOOLS.map((tool) => {
              const status = cliStatus[tool.id]
              const isIdeOnly = !tool.cli.supportsHeadless
              const isAvailable = status?.available
              const version = status?.version

              return (
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                          {isIdeOnly ? (
                            <Chip
                              icon={<DesktopWindowsIcon sx={{ fontSize: '0.9rem !important' }} />}
                              label="IDE Only"
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          ) : status ? (
                            isAvailable ? (
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                                label={version ? `v${version}` : 'Available'}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            ) : (
                              <Chip
                                icon={<ErrorIcon sx={{ fontSize: '0.9rem !important' }} />}
                                label="Not Found"
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )
                          ) : detectingCli ? (
                            <CircularProgress size={14} />
                          ) : null}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {tool.description}
                        </Typography>
                        {!isIdeOnly && status && !isAvailable && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                            Install {tool.cli.cliCommand} CLI to enable agent chat
                          </Typography>
                        )}
                        {isIdeOnly && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                            Use copy-to-clipboard workflow for this IDE
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
              )
            })}
          </RadioGroup>
        </DialogContent>
      </Dialog>

      {/* Chat Settings Dialog */}
      <Dialog
        open={chatSettingsDialogOpen}
        onClose={() => setChatSettingsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Chat Settings
          <IconButton size="small" onClick={() => setChatSettingsDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure the teammate chat interface settings.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Max Messages Per Thread
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Older messages will be removed when this limit is reached. Range: 50-500
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={maxThreadMessages}
                onChange={(_, value) => setMaxThreadMessages(value as number)}
                min={50}
                max={500}
                step={10}
                marks={[
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                  { value: 250, label: '250' },
                  { value: 500, label: '500' }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              Current: <strong>{maxThreadMessages}</strong> messages
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Principal Branch Selection Dialog */}
      <Dialog
        open={branchDialogOpen}
        onClose={() => setBranchDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Principal Branch
          <IconButton size="small" onClick={() => setBranchDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select your repository's main/principal branch. This is used for branch comparisons and story editing restrictions.
          </Typography>
          <RadioGroup
            value={principalBranch}
            onChange={(e) => setPrincipalBranch(e.target.value as 'main' | 'master' | 'develop')}
          >
            {(['main', 'master', 'develop'] as const).map((branch) => (
              <Box
                key={branch}
                sx={{
                  p: 1.5,
                  mb: 1,
                  border: 1,
                  borderColor: principalBranch === branch ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={() => setPrincipalBranch(branch)}
              >
                <FormControlLabel
                  value={branch}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography fontWeight={500}>{branch}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {branch === 'main' && 'Modern default branch name'}
                        {branch === 'master' && 'Traditional default branch name'}
                        {branch === 'develop' && 'Development branch (GitFlow)'}
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
