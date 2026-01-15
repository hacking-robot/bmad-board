import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import VerifiedIcon from '@mui/icons-material/Verified'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '../../store'
import { EPIC_COLORS, STATUS_COLUMNS } from '../../types'

export default function StoryDialog() {
  const selectedStory = useStore((state) => state.selectedStory)
  const storyContent = useStore((state) => state.storyContent)
  const setSelectedStory = useStore((state) => state.setSelectedStory)

  const handleClose = () => {
    setSelectedStory(null)
  }

  if (!selectedStory) return null

  const epicColor = EPIC_COLORS[(selectedStory.epicId - 1) % EPIC_COLORS.length]
  const statusConfig = STATUS_COLUMNS.find((c) => c.status === selectedStory.status)

  return (
    <Dialog
      open={Boolean(selectedStory)}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          pr: 6
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={`Epic ${selectedStory.epicId}`}
              size="small"
              sx={{
                bgcolor: epicColor,
                color: 'white',
                fontWeight: 600
              }}
            />
            <Chip
              label={statusConfig?.label || selectedStory.status}
              size="small"
              sx={{
                bgcolor: statusConfig?.color,
                color: 'white',
                fontWeight: 600
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Story {selectedStory.epicId}.{selectedStory.storyNumber}
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight={600}>
            {selectedStory.title}
          </Typography>
        </Box>

        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {!storyContent && selectedStory.filePath ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 6,
              gap: 2
            }}
          >
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading story content...</Typography>
          </Box>
        ) : !storyContent ? (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              No story file available. This story is still in backlog.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Story Description */}
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Story
              </Typography>
              <Box
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                  p: 2,
                  '& p': { m: 0 }
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {storyContent.description}
                </ReactMarkdown>
              </Box>
            </Box>

            <Divider />

            {/* Acceptance Criteria */}
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Acceptance Criteria ({storyContent.acceptanceCriteria.length})
              </Typography>
              <List dense disablePadding>
                {storyContent.acceptanceCriteria.map((ac, index) => (
                  <ListItem key={ac.id} sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600
                        }}
                      >
                        {index + 1}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={ac.title}
                      secondary={ac.description}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider />

            {/* Tasks */}
            {storyContent.tasks.length > 0 && (
              <>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Tasks ({storyContent.tasks.filter((t) => t.completed).length}/{storyContent.tasks.length})
                  </Typography>
                  <List dense disablePadding>
                    {storyContent.tasks.map((task) => (
                      <Box key={task.id}>
                        <ListItem sx={{ px: 0, py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {task.completed ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                              <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={task.title}
                            primaryTypographyProps={{
                              fontWeight: 500,
                              sx: task.completed
                                ? { textDecoration: 'line-through', color: 'text.secondary' }
                                : {}
                            }}
                          />
                        </ListItem>
                        {task.subtasks.length > 0 && (
                          <List dense disablePadding sx={{ pl: 4 }}>
                            {task.subtasks.map((subtask) => (
                              <ListItem key={subtask.id} sx={{ px: 0, py: 0.25 }}>
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                  {subtask.completed ? (
                                    <CheckCircleIcon
                                      color="success"
                                      sx={{ fontSize: 16 }}
                                    />
                                  ) : (
                                    <RadioButtonUncheckedIcon
                                      color="disabled"
                                      sx={{ fontSize: 16 }}
                                    />
                                  )}
                                </ListItemIcon>
                                <ListItemText
                                  primary={subtask.title}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    sx: subtask.completed
                                      ? { textDecoration: 'line-through', color: 'text.secondary' }
                                      : {}
                                  }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                    ))}
                  </List>
                </Box>
                <Divider />
              </>
            )}

            {/* Dev Notes (Collapsible) */}
            {storyContent.devNotes && (
              <Accordion elevation={0} disableGutters>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 3, bgcolor: 'action.hover' }}
                >
                  <Typography variant="h6">Dev Notes</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3 }}>
                  <Box
                    sx={{
                      '& h1, & h2, & h3, & h4': {
                        mt: 2,
                        mb: 1,
                        '&:first-of-type': { mt: 0 }
                      },
                      '& p': { mb: 1 },
                      '& pre': {
                        bgcolor: 'action.hover',
                        p: 2,
                        borderRadius: 1,
                        overflow: 'auto'
                      },
                      '& code': {
                        bgcolor: 'action.hover',
                        px: 0.5,
                        borderRadius: 0.5,
                        fontFamily: 'monospace'
                      },
                      '& table': {
                        width: '100%',
                        borderCollapse: 'collapse',
                        '& th, & td': {
                          border: 1,
                          borderColor: 'divider',
                          p: 1
                        },
                        '& th': {
                          bgcolor: 'action.hover',
                          fontWeight: 600
                        }
                      }
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {storyContent.devNotes}
                    </ReactMarkdown>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {/* File Changes (Collapsible) */}
            {storyContent.fileChanges && (
              <Accordion elevation={0} disableGutters>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 3, bgcolor: 'action.hover' }}
                >
                  <Typography variant="h6">File Changes</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3 }}>
                  {storyContent.fileChanges.created.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                      >
                        <AddIcon fontSize="small" color="success" />
                        Created ({storyContent.fileChanges.created.length})
                      </Typography>
                      <Box
                        component="ul"
                        sx={{
                          m: 0,
                          pl: 3,
                          '& li': { fontFamily: 'monospace', fontSize: '0.875rem' }
                        }}
                      >
                        {storyContent.fileChanges.created.map((file, i) => (
                          <li key={i}>{file}</li>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {storyContent.fileChanges.modified.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                      >
                        <EditIcon fontSize="small" color="warning" />
                        Modified ({storyContent.fileChanges.modified.length})
                      </Typography>
                      <Box
                        component="ul"
                        sx={{
                          m: 0,
                          pl: 3,
                          '& li': { fontFamily: 'monospace', fontSize: '0.875rem' }
                        }}
                      >
                        {storyContent.fileChanges.modified.map((file, i) => (
                          <li key={i}>{file}</li>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {storyContent.fileChanges.verified.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                      >
                        <VerifiedIcon fontSize="small" color="info" />
                        Verified ({storyContent.fileChanges.verified.length})
                      </Typography>
                      <Box
                        component="ul"
                        sx={{
                          m: 0,
                          pl: 3,
                          '& li': { fontFamily: 'monospace', fontSize: '0.875rem' }
                        }}
                      >
                        {storyContent.fileChanges.verified.map((file, i) => (
                          <li key={i}>{file}</li>
                        ))}
                      </Box>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
