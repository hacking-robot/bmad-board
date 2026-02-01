/// <reference types="vite/client" />

declare global {
  interface Window {
    whisperAPI: import('./types').WhisperAPI
  }
}
