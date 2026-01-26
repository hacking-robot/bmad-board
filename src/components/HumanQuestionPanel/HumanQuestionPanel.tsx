import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  Chip,
  Divider
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer'
import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import type { HumanQuestion } from '../../types/orchestration'

interface QuestionItemProps {
  question: HumanQuestion
  onAnswer: (id: string, answer: string) => void
  onDismiss: (id: string) => void
}

function QuestionItem({ question, onAnswer, onDismiss }: QuestionItemProps) {
  const [answer, setAnswer] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)

  const handleSubmit = useCallback(() => {
    if (answer.trim()) {
      onAnswer(question.id, answer.trim())
      setAnswer('')
      setIsAnswering(false)
    }
  }, [answer, onAnswer, question.id])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const timeAgo = getTimeAgo(question.timestamp)

  return (
    <ListItem
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 1,
        py: 1.5
      }}
    >
      {/* Question header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
        <QuestionAnswerIcon sx={{ fontSize: '1.1rem', color: 'primary.main', mt: 0.3 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {question.question}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {timeAgo}
            </Typography>
            {question.context.storyId && (
              <Chip
                label={question.context.storyTitle || question.context.storyId}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
        </Box>
        <Tooltip title="Dismiss">
          <IconButton
            size="small"
            onClick={() => onDismiss(question.id)}
            sx={{ ml: 'auto' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Answer input */}
      {isAnswering ? (
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, width: '100%' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type your answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            multiline
            maxRows={3}
          />
          <Tooltip title="Send answer">
            <span>
              <IconButton
                color="primary"
                onClick={handleSubmit}
                disabled={!answer.trim()}
                size="small"
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ) : (
        <Box
          onClick={() => setIsAnswering(true)}
          sx={{
            mt: 1,
            p: 1,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'text',
            '&:hover': { borderColor: 'primary.main' }
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Click to answer...
          </Typography>
        </Box>
      )}
    </ListItem>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function HumanQuestionPanel() {
  const [expanded, setExpanded] = useState(true)

  const pendingQuestions = useStore((state) => state.orchestration.pendingQuestions)
  const answerQuestion = useStore((state) => state.answerOrchestrationQuestion)
  const dismissQuestion = useStore((state) => state.dismissOrchestrationQuestion)

  // Only show pending questions
  const questions = pendingQuestions.filter(q => q.status === 'pending')

  if (questions.length === 0) {
    return null
  }

  return (
    <Paper
      elevation={2}
      sx={{
        mx: 2,
        mb: 2,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          cursor: 'pointer',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' }
        }}
      >
        <QuestionAnswerIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Oracle Questions ({questions.length})
        </Typography>
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      {/* Question list */}
      <Collapse in={expanded}>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          <List sx={{ p: 1 }}>
            {questions.map((question, index) => (
              <Box key={question.id}>
                {index > 0 && <Divider sx={{ my: 1 }} />}
                <QuestionItem
                  question={question}
                  onAnswer={answerQuestion}
                  onDismiss={dismissQuestion}
                />
              </Box>
            ))}
          </List>
        </Box>
      </Collapse>
    </Paper>
  )
}
