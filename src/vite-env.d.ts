/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_AGENTS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
