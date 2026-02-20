import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Button, Typography, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Stack } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import VerifiedIcon from '@mui/icons-material/Verified'
import { useStore } from '../../store'

import type { BmadVersion } from '../../types'

interface InstallStepProps {
  onComplete: () => void
}

export default function InstallStep({ onComplete }: InstallStepProps) {
  const { projectWizard, appendWizardInstallLog, setWizardError, updateWizardStep, setBmadVersion } = useStore()
  const logEndRef = useRef<HTMLDivElement>(null)
  const [selectedVersion, setSelectedVersion] = useState<BmadVersion>('stable')
  const isInstalling = projectWizard.stepStatuses[0] === 'active'
  const isCompleted = projectWizard.stepStatuses[0] === 'completed'
  const hasError = projectWizard.stepStatuses[0] === 'error'

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [projectWizard.installProgress])

  // Listen for install output and completion
  useEffect(() => {
    const cleanupOutput = window.wizardAPI.onInstallOutput((event) => {
      const lines = event.chunk.split('\n').filter(Boolean)
      for (const line of lines) {
        appendWizardInstallLog(line)
      }
    })

    const cleanupComplete = window.wizardAPI.onInstallComplete((event) => {
      if (event.success) {
        setBmadVersion(selectedVersion)
        updateWizardStep(0, 'completed')
        onComplete()
      } else {
        updateWizardStep(0, 'error')
        setWizardError(event.error || 'Installation failed')
      }
    })

    return () => {
      cleanupOutput()
      cleanupComplete()
    }
  }, [appendWizardInstallLog, updateWizardStep, setWizardError, setBmadVersion, selectedVersion, onComplete])

  const handleInstall = useCallback(async () => {
    if (!projectWizard.projectPath) return

    setWizardError(null)
    updateWizardStep(0, 'active')

    const result = await window.wizardAPI.install(projectWizard.projectPath, selectedVersion === 'alpha')
    if (!result.success) {
      updateWizardStep(0, 'error')
      setWizardError(result.error || 'Failed to start installation')
    }
  }, [projectWizard.projectPath, selectedVersion, updateWizardStep, setWizardError])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        This will run <code>npx bmad-method install</code> to set up BMAD in your project folder.
        It installs the necessary configuration files and templates.
      </Typography>

      {!isInstalling && !isCompleted && !hasError && (
        <Stack spacing={2}>
          {/* Version selector */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Version
            </Typography>
            <ToggleButtonGroup
              value={selectedVersion}
              exclusive
              onChange={(_, value) => { if (value) setSelectedVersion(value) }}
              size="small"
              fullWidth
            >
              <ToggleButton value="stable" sx={{ textTransform: 'none', gap: 0.5 }}>
                <VerifiedIcon sx={{ fontSize: 16 }} />
                Stable
              </ToggleButton>
              <ToggleButton value="alpha" sx={{ textTransform: 'none', gap: 0.5 }}>
                <NewReleasesIcon sx={{ fontSize: 16 }} />
                Alpha
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              {selectedVersion === 'stable'
                ? 'Production release - recommended for most projects'
                : 'Latest pre-release - requires manual install via terminal'}
            </Typography>
          </Box>

          {selectedVersion === 'alpha' && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
              The alpha version requires interactive terminal input. Run this in your terminal:
              <Box component="code" sx={{ display: 'block', mt: 0.5, p: 0.5, bgcolor: 'action.hover', borderRadius: 0.5, fontSize: '0.75rem' }}>
                cd {projectWizard.projectPath}<br />
                npx bmad-method@alpha install
              </Box>
              Then click "Mark as Installed" below when done.
            </Alert>
          )}

          {selectedVersion === 'alpha' ? (
            <Button
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              onClick={() => {
                setBmadVersion('alpha')
                updateWizardStep(0, 'completed')
                onComplete()
              }}
            >
              Mark as Installed
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleInstall}
            >
              Install BMAD Method
            </Button>
          )}
        </Stack>
      )}

      {isInstalling && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="primary">
            Installing{selectedVersion === 'alpha' ? ' alpha' : ''}...
          </Typography>
        </Box>
      )}

      {isCompleted && (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          BMAD Method installed successfully!
        </Alert>
      )}

      {hasError && projectWizard.error && (
        <Alert severity="error">
          {projectWizard.error}
          <Button size="small" onClick={handleInstall} sx={{ ml: 1 }}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Terminal-like log output */}
      {projectWizard.installProgress.length > 0 && (
        <Box
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            p: 1.5,
            borderRadius: 1,
            maxHeight: 200,
            overflow: 'auto',
            lineHeight: 1.6
          }}
        >
          {projectWizard.installProgress.map((line, i) => (
            <Box key={i} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line}
            </Box>
          ))}
          <div ref={logEndRef} />
        </Box>
      )}
    </Box>
  )
}
