export type ProjectType = 'bmm' | 'bmgd'

export interface ProjectConfig {
  epicsPath: string
  sprintStatusPath: string
}

export const PROJECT_CONFIGS: Record<ProjectType, ProjectConfig> = {
  bmm: {
    epicsPath: 'planning-artifacts/epics.md',
    sprintStatusPath: 'implementation-artifacts/sprint-status.yaml'
  },
  bmgd: {
    epicsPath: 'epics.md',
    sprintStatusPath: 'implementation-artifacts/sprint-status.yaml'
  }
}

export function getEpicsFullPath(projectPath: string, projectType: ProjectType): string {
  return `${projectPath}/_bmad-output/${PROJECT_CONFIGS[projectType].epicsPath}`
}

export function getSprintStatusFullPath(projectPath: string, projectType: ProjectType): string {
  return `${projectPath}/_bmad-output/${PROJECT_CONFIGS[projectType].sprintStatusPath}`
}
