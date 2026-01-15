import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  Box,
  Typography,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import CategoryIcon from '@mui/icons-material/Category'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
}

interface CommandType {
  prefix: string
  label: string
  getItems: () => CommandItem[]
}

// Truncate path for display
const truncatePath = (path: string, maxLength: number = 50) => {
  if (path.length <= maxLength) return path
  return '...' + path.slice(-maxLength)
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const projectPath = useStore((state) => state.projectPath)
  const recentProjects = useStore((state) => state.recentProjects)
  const epics = useStore((state) => state.epics)
  const selectedEpicId = useStore((state) => state.selectedEpicId)
  const setSelectedEpicId = useStore((state) => state.setSelectedEpicId)
  const { selectProject, switchToProject } = useProjectData()

  // Define command types
  const commandTypes: CommandType[] = useMemo(() => [
    {
      prefix: 'project:',
      label: 'Projects',
      getItems: () => {
        const items: CommandItem[] = []

        // Add recent projects
        recentProjects.forEach((project) => {
          items.push({
            id: `project:${project.path}`,
            label: project.name,
            description: truncatePath(project.path),
            icon: <FolderIcon sx={{ color: project.path === projectPath ? 'primary.main' : 'text.secondary' }} />,
            action: () => {
              switchToProject(project.path, project.projectType)
              setOpen(false)
            }
          })
        })

        // Add open project command
        items.push({
          id: 'project:open',
          label: 'Open Project...',
          description: 'Browse to open a project folder',
          icon: <FolderOpenIcon sx={{ color: 'text.secondary' }} />,
          action: () => {
            selectProject()
            setOpen(false)
          }
        })

        return items
      }
    },
    {
      prefix: 'epic:',
      label: 'Epics',
      getItems: () => {
        const items: CommandItem[] = []

        // Add "All Epics" option
        items.push({
          id: 'epic:all',
          label: 'All Epics',
          description: 'Show stories from all epics',
          icon: <AllInclusiveIcon sx={{ color: selectedEpicId === null ? 'primary.main' : 'text.secondary' }} />,
          action: () => {
            setSelectedEpicId(null)
            setOpen(false)
          }
        })

        // Add each epic
        epics.forEach((epic) => {
          items.push({
            id: `epic:${epic.id}`,
            label: epic.name,
            description: `Epic ${epic.id} · ${epic.stories.length} stories`,
            icon: <CategoryIcon sx={{ color: selectedEpicId === epic.id ? 'primary.main' : 'text.secondary' }} />,
            action: () => {
              setSelectedEpicId(epic.id)
              setOpen(false)
            }
          })
        })

        return items
      }
    },
    {
      prefix: '>',
      label: 'Commands',
      getItems: () => [
        {
          id: 'command:keyboard-shortcuts',
          label: 'Preferences: Keyboard Shortcuts',
          description: 'View all keyboard shortcuts',
          icon: <KeyboardIcon sx={{ color: 'text.secondary' }} />,
          action: () => {
            setOpen(false)
            window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))
          }
        },
        {
          id: 'command:open-project',
          label: 'File: Open Project',
          description: 'Browse to open a project folder',
          icon: <FolderOpenIcon sx={{ color: 'text.secondary' }} />,
          action: () => {
            selectProject()
            setOpen(false)
          }
        }
      ]
    }
  ], [recentProjects, projectPath, switchToProject, selectProject, epics, selectedEpicId, setSelectedEpicId])

  // Parse input to get active prefix and search query
  const { activeType, searchQuery } = useMemo(() => {
    for (const type of commandTypes) {
      if (inputValue.startsWith(type.prefix)) {
        return {
          activeType: type,
          searchQuery: inputValue.slice(type.prefix.length).trim()
        }
      }
    }
    // No matching prefix - show all command types as options
    return { activeType: null, searchQuery: inputValue.trim() }
  }, [inputValue, commandTypes])

  // Get filtered items based on active type and search query
  const filteredItems = useMemo(() => {
    if (!activeType) {
      // No active type - show command type options
      return commandTypes
        .filter((type) =>
          !searchQuery ||
          type.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          type.prefix.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map((type) => ({
          id: `type:${type.prefix}`,
          label: type.label,
          description: `Type ${type.prefix} to search`,
          icon: <Chip label={type.prefix} size="small" sx={{ fontFamily: 'monospace', height: 24, fontSize: '0.75rem' }} />,
          action: () => {
            setInputValue(type.prefix)
            setSelectedIndex(0)
            // Keep focus on input for continued typing
            setTimeout(() => searchInputRef.current?.focus(), 0)
          }
        }))
    }

    // Filter items from active type
    const items = activeType.getItems()
    if (!searchQuery) return items

    const query = searchQuery.toLowerCase()
    return items.filter((item) =>
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    )
  }, [activeType, searchQuery, commandTypes])

  // Global keyboard listener for Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus search input and select text after prefix when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
          // Position cursor at the end
          const len = searchInputRef.current.value.length
          searchInputRef.current.setSelectionRange(len, len)
        }
      }, 50)
      return () => clearTimeout(timer)
    } else {
      // Reset when closing
      setInputValue('')
      setSelectedIndex(0)
    }
  }, [open])

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selectedItem = filteredItems[selectedIndex]
      if (selectedItem) {
        selectedItem.action()
      }
    } else if (e.key === 'Escape') {
      handleClose()
    } else if (e.key === 'Backspace' && activeType && inputValue === activeType.prefix) {
      // When backspacing on empty prefix, clear the prefix
      e.preventDefault()
      setInputValue('')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            position: 'fixed',
            top: '15%',
            m: 0,
            borderRadius: 2,
            bgcolor: 'background.paper',
            overflow: 'hidden'
          }
        },
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh'
        }}
      >
        {/* Search input */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          {activeType && (
            <Chip
              label={activeType.prefix.replace(':', '')}
              size="small"
              color="primary"
              onDelete={() => setInputValue('')}
              sx={{ fontFamily: 'monospace' }}
            />
          )}
          <InputBase
            inputRef={searchInputRef}
            placeholder={activeType ? `Search ${activeType.label.toLowerCase()}...` : 'Type a command prefix...'}
            value={activeType ? searchQuery : inputValue}
            onChange={(e) => {
              if (activeType) {
                setInputValue(activeType.prefix + e.target.value)
              } else {
                setInputValue(e.target.value)
              }
            }}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={{
              fontSize: '1rem',
              '& input::placeholder': {
                color: 'text.secondary',
                opacity: 1
              }
            }}
          />
        </Box>

        {/* Results list */}
        <List
          ref={listRef}
          sx={{
            py: 1,
            overflowY: 'auto',
            flex: 1
          }}
        >
          {filteredItems.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 2, py: 1, fontStyle: 'italic' }}
            >
              No results found
            </Typography>
          ) : (
            filteredItems.map((item, index) => (
              <ListItemButton
                key={item.id}
                selected={index === selectedIndex}
                onClick={() => item.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                sx={{
                  py: 1,
                  px: 2,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected'
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: 'action.selected'
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 80 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  slotProps={{
                    primary: {
                      variant: 'body2',
                      fontWeight: 500
                    },
                    secondary: {
                      variant: 'caption',
                      sx: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }
                  }}
                />
              </ListItemButton>
            ))
          )}
        </List>

        {/* Footer with keyboard hints */}
        <Box
          sx={{
            px: 2,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            bgcolor: 'action.hover'
          }}
        >
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontFamily: 'monospace', mr: 0.5 }}>↑↓</Box>
            navigate
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontFamily: 'monospace', mr: 0.5 }}>↵</Box>
            select
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontFamily: 'monospace', mr: 0.5 }}>esc</Box>
            close
          </Typography>
        </Box>
      </Box>
    </Dialog>
  )
}
