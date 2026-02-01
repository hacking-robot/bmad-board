/**
 * Text-to-Speech Service
 *
 * Handles voice synthesis using Sherpa-ONNX neural TTS (Kokoro-82M)
 * with say.js fallback for macOS system TTS.
 *
 * Communicates with the main process via IPC bridge.
 */

import { cleanForSpeech } from '../utils/textFormatter';

// ============================================================================
// Types
// ============================================================================

export type TTSBackend = 'sherpa-onnx' | 'say.js';

export interface TTSConfig {
  voice?: string;
  volume: number;
  rate: number;
  pitch: number;
}

export interface TTSPlaybackEvent {
  event: 'start' | 'sentence-start' | 'sentence-end' | 'complete';
  index?: number;
  total?: number;
  text?: string;
}

export interface TTSState {
  isSpeaking: boolean;
  currentSentence: number;
  totalSentences: number;
  backend: TTSBackend | null;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  sizeBytes: number;
  backend: TTSBackend;
}

export interface TTSLoadingEvent {
  state: 'loading' | 'ready' | 'error' | 'fallback';
  progress: number;
  message: string;
  backend?: TTSBackend;
  error?: string;
}

export interface TTSStreamingEvent {
  event: 'start' | 'sentence-start' | 'sentence-end' | 'complete' | 'error';
  index?: number;
  total?: number;
  text?: string;
  durationMs?: number;
  error?: string;
}

// ============================================================================
// Module State
// ============================================================================

let ttsState: TTSState = {
  isSpeaking: false,
  currentSentence: 0,
  totalSentences: 0,
  backend: null,
};

// State change listeners
type StateListener = (state: TTSState) => void;
const stateListeners: Set<StateListener> = new Set();

function updateState(updates: Partial<TTSState>): void {
  ttsState = { ...ttsState, ...updates };
  for (const listener of stateListeners) {
    listener(ttsState);
  }
}

export function subscribeToState(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function getTTSState(): TTSState {
  return { ...ttsState };
}

// ============================================================================
// Initialization
// ============================================================================

let currentBackend: TTSBackend = 'say.js';
let availableVoices: TTSVoice[] = [];

// Loading event listeners
type LoadingListener = (event: TTSLoadingEvent) => void;
const loadingListeners: Set<LoadingListener> = new Set();

// Streaming progress listeners
type StreamingListener = (event: TTSStreamingEvent) => void;
const streamingListeners: Set<StreamingListener> = new Set();

export async function initTTS(): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('[TTS] Window not available');
    return;
  }

  const ttsAPI = (window as any).ttsAPI;
  if (!ttsAPI) {
    console.warn('[TTS] TTS API not available');
    return;
  }

  // Set up loading event listener
  ttsAPI.onLoading((event: TTSLoadingEvent) => {
    console.log('[TTS] Loading event:', event);
    for (const listener of loadingListeners) {
      listener(event);
    }
    if (event.backend) {
      currentBackend = event.backend;
      updateState({ backend: event.backend });
    }
  });

  // Set up streaming progress listener
  ttsAPI.onStreamingProgress((event: TTSStreamingEvent) => {
    console.log('[TTS] Streaming event:', event);
    for (const listener of streamingListeners) {
      listener(event);
    }
    if (event.event === 'start' && event.total) {
      updateState({ totalSentences: event.total });
    } else if (event.event === 'sentence-start' && event.index !== undefined) {
      updateState({ currentSentence: event.index });
    } else if (event.event === 'complete') {
      updateState({ isSpeaking: false, currentSentence: 0, totalSentences: 0 });
    }
  });

  // Initialize TTS system
  try {
    const backend = await ttsAPI.initialize();
    currentBackend = backend;
    updateState({ backend });

    // Load available voices
    availableVoices = await ttsAPI.getVoices();
    console.log(`[TTS] Initialized with ${backend}, ${availableVoices.length} voices available`);
  } catch (error) {
    console.error('[TTS] Failed to initialize:', error);
  }
}

export function isTTSReady(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ttsAPI;
}

export function getAvailableVoices(): TTSVoice[] {
  return [...availableVoices];
}

export function getCurrentBackend(): TTSBackend {
  return currentBackend;
}

// ============================================================================
// Event Listeners
// ============================================================================

export function onLoading(callback: LoadingListener): () => void {
  loadingListeners.add(callback);
  return () => {
    loadingListeners.delete(callback);
  };
}

export function onStreamingProgress(callback: StreamingListener): () => void {
  streamingListeners.add(callback);
  return () => {
    streamingListeners.delete(callback);
  };
}

// ============================================================================
// Speech Generation
// ============================================================================

/**
 * Speak text using TTS with streaming by sentence.
 * @param text - The text to speak
 * @param config - TTS configuration
 * @param onPlayback - Optional callback for playback events
 */
export async function speak(
  text: string,
  config: Partial<TTSConfig> = {},
  onPlayback?: (event: TTSPlaybackEvent) => void
): Promise<void> {
  const ttsAPI = (window as any).ttsAPI;
  if (!ttsAPI) {
    console.warn('[TTS] TTS API not available');
    return;
  }

  updateState({ isSpeaking: true });

  // Clean markdown and format for natural speech
  const cleanedText = cleanForSpeech(text);

  try {
    // Convert config to TTS options
    const options = {
      voiceId: config.voice,
      volume: config.volume ?? 1.0,
      speed: config.rate ?? 1.0,
    };

    // Use streaming TTS for sentence-by-sentence playback
    await ttsAPI.speakStreaming(cleanedText, options);

    onPlayback?.({ event: 'complete' });
  } catch (error) {
    console.error('[TTS] Speech error:', error);
    onPlayback?.({ event: 'complete' });
  } finally {
    updateState({ isSpeaking: false, currentSentence: 0, totalSentences: 0 });
  }
}

/**
 * Interrupt current speech.
 */
export function interruptSpeech(): void {
  const ttsAPI = (window as any).ttsAPI;
  if (!ttsAPI) {
    console.warn('[TTS] TTS API not available');
    return;
  }

  ttsAPI.stop();
  updateState({
    isSpeaking: false,
    currentSentence: 0,
    totalSentences: 0,
  });
}

/**
 * Check if currently speaking.
 */
export function isSpeaking(): boolean {
  return ttsState.isSpeaking;
}

// ============================================================================
// Voice Management
// ============================================================================

export async function loadVoice(voiceId: string): Promise<boolean> {
  const ttsAPI = (window as any).ttsAPI;
  if (!ttsAPI) {
    console.warn('[TTS] TTS API not available');
    return false;
  }

  try {
    return await ttsAPI.loadVoice(voiceId);
  } catch (error) {
    console.error('[TTS] Failed to load voice:', error);
    return false;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export function unloadTTS(): void {
  interruptSpeech();
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  volume: 1.0,
  rate: 1.0,
  pitch: 1.0,
};
