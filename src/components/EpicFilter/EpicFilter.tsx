import { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  Box,
  Typography,
  LinearProgress,
  Divider
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useStore } from '../../store'
import { EPIC_COLORS } from '../../types'

export default function EpicFilter() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const epics = useStore((state) => state.epics)
  const selectedEpicId = useStore((state) => state.selectedEpicId)
  const setSelectedEpicId = useStore((state) => state.setSelectedEpicId)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelect = (epicId: number | null) => {
    setSelectedEpicId(epicId)
    handleClose()
  }

  const selectedEpic = epics.find((e) => e.id === selectedEpicId)

  // Calculate progress for each epic
  const getEpicProgress = (epicId: number) => {
    const epic = epics.find((e) => e.id === epicId)
    if (!epic || epic.stories.length === 0) return 0
    const doneCount = epic.stories.filter((s) => s.status === 'done').length
    return (doneCount / epic.stories.length) * 100
  }

  return (
    <>
      <Button
        onClick={handleClick}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          bgcolor: 'action.hover',
          px: 2,
          '&:hover': {
            bgcolor: 'action.selected'
          }
        }}
      >
        {selectedEpic ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: EPIC_COLORS[(selectedEpic.id - 1) % EPIC_COLORS.length]
              }}
            />
            <Typography variant="body2">Epic {selectedEpic.id}</Typography>
          </Box>
        ) : (
          <Typography variant="body2">All Epics</Typography>
        )}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxHeight: 400
          }
        }}
      >
        <MenuItem
          onClick={() => handleSelect(null)}
          selected={selectedEpicId === null}
        >
          <Typography>All Epics</Typography>
        </MenuItem>

        <Divider />

        {epics.map((epic) => {
          const progress = getEpicProgress(epic.id)
          const color = EPIC_COLORS[(epic.id - 1) % EPIC_COLORS.length]

          return (
            <MenuItem
              key={epic.id}
              onClick={() => handleSelect(epic.id)}
              selected={selectedEpicId === epic.id}
              sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: color,
                    flexShrink: 0
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Epic {epic.id}: {epic.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {epic.stories.filter((s) => s.status === 'done').length}/{epic.stories.length}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 2
                  }
                }}
              />
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}
