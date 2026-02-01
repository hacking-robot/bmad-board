/**
 * TTS Handler
 *
 * Handles text-to-speech with dual backend support:
 * 1. Primary: Sherpa-ONNX with Kokoro-82M neural TTS (high quality)
 * 2. Fallback: Native system TTS via say.js (always available)
 *
 * Streaming TTS uses a worker thread to preload sentences while playing.
 */

import { ipcMain, BrowserWindow } from 'electron';
import say from 'say';
import {
  initializeSherpaOnnx,
  generateSpeech,
  setVoice as setSherpaVoice,
  isReady as isSherpaReady,
  kokoroModelExists,
  KOKORO_VOICES,
} from './sherpaOnnxTts';

// ============================================================================
// Types
// ============================================================================

export type TTSBackend = 'sherpa-onnx' | 'say.js';

interface TTSOptions {
  voiceId?: string;
  volume?: number;
  speed?: number;
}

interface VoiceInfo {
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

// ============================================================================
// Module State
// ============================================================================

let currentBackend: TTSBackend = 'say.js';
let isSpeaking = false;
let currentVoice: string | null = null;

// Speaker module for audio playback (loaded dynamically, optional)
let Speaker: any = null;
let currentSpeaker: any = null;
let pendingPlaybackResolve: (() => void) | null = null;

// Streaming TTS state
interface AudioChunk {
  samples: Float32Array;
  sampleRate: number;
  text: string;
  index: number;
}

let streamingQueue: AudioChunk[] = [];
let isStreamingActive = false;
let isPlaybackActive = false;
let streamingAborted = false;
let currentStreamWindow: BrowserWindow | null = null;

// Utility process for background TTS generation (doesn't block main thread)
let ttsUtilityProcess: any | null = null;
let utilityProcessReady = false;
let pendingGenerations: Map<number, (result: AudioChunk | null) => void> = new Map();
let generationIdCounter = 0;

// Preload configuration
const PRELOAD_AHEAD = 2; // Number of sentences to preload ahead

// ============================================================================
// Audio Playback
// ============================================================================

// Web Audio API nodes for fallback playback (when speaker module unavailable)
let currentSourceNode: AudioBufferSourceNode | null = null;

/**
 * Load the speaker module dynamically.
 */
async function loadSpeakerModule(): Promise<boolean> {
  if (Speaker) return true;

  try {
    // Use require instead of import for externalized native modules
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Speaker = require('speaker');
    return true;
  } catch (error) {
    console.warn('[TTS] Speaker module not available, will use Web Audio API fallback');
    return false;
  }
}


/**
 * Play audio samples using speaker module or send to renderer for Web Audio API playback.
 * Resolves immediately if streaming is aborted.
 */
async function playAudio(samples: Float32Array, sampleRate: number): Promise<void> {
  // Check if already aborted before starting
  if (streamingAborted) {
    return;
  }

  // Try speaker module first
  if (!Speaker) {
    const loaded = await loadSpeakerModule();
    if (!loaded) {
      // Fall back to Web Audio API in renderer
      return playAudioInRenderer(samples, sampleRate);
    }
  }

  return new Promise((resolve, reject) => {
    // Check again in case aborted while loading
    if (streamingAborted) {
      resolve();
      return;
    }

    try {
      // Convert Float32Array to 16-bit PCM for broader compatibility
      const int16Samples = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      currentSpeaker = new Speaker!({
        channels: 1,
        bitDepth: 16,
        sampleRate: sampleRate,
        signed: true,
      });

      let resolved = false;
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          pendingPlaybackResolve = null;
          resolve();
        }
      };

      // Store resolve function so stopAudioPlayback can call it
      pendingPlaybackResolve = resolveOnce;

      currentSpeaker.on('close', () => {
        currentSpeaker = null;
        resolveOnce();
      });

      currentSpeaker.on('error', (err: unknown) => {
        currentSpeaker = null;
        pendingPlaybackResolve = null;
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Check abort before writing (once written, audio plays from OS buffer)
      if (streamingAborted) {
        currentSpeaker.close(true);
        currentSpeaker = null;
        resolveOnce();
        return;
      }

      // Write audio data and end the stream
      currentSpeaker.write(Buffer.from(int16Samples.buffer));
      currentSpeaker.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Play audio in renderer process using Web Audio API.
 * Used when speaker module is not available.
 */
function playAudioInRenderer(samples: Float32Array, sampleRate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (streamingAborted) {
      resolve();
      return;
    }

    try {
      // Send audio data to renderer for playback
      currentStreamWindow?.webContents.send('tts:play-audio', {
        samples: Array.from(samples),
        sampleRate,
      });

      // Store resolve function for when playback completes
      pendingPlaybackResolve = resolve;

      // Set a timeout to resolve automatically (audio duration + buffer)
      const durationMs = (samples.length / sampleRate) * 1000;
      const timeout = setTimeout(() => {
        pendingPlaybackResolve = null;
        resolve();
      }, durationMs + 500);

      // Store timeout for cleanup
      (pendingPlaybackResolve as unknown as { timeout: NodeJS.Timeout }) = {
        timeout,
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
      } as any;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop current audio playback immediately.
 */
function stopAudioPlayback(): void {
  // Resolve any pending playback promise first
  if (pendingPlaybackResolve) {
    const pending = pendingPlaybackResolve as any;
    pendingPlaybackResolve = null;

    // Handle different pending playback types
    if (typeof pending === 'function') {
      // Regular resolve function
      pending();
    } else if (pending?.timeout && typeof pending.resolve === 'function') {
      // Renderer playback with timeout
      clearTimeout(pending.timeout);
      pending.resolve();
    }

    // Notify renderer to stop playback
    currentStreamWindow?.webContents.send('tts:stop-audio');
  }

  if (currentSpeaker) {
    const speaker = currentSpeaker;
    currentSpeaker = null; // Clear reference first
    try {
      // Remove all listeners to prevent duplicate callbacks
      speaker.removeAllListeners();
      // Try multiple methods to stop immediately
      if (typeof speaker.destroy === 'function') {
        speaker.destroy();
      } else {
        // Force close to stop immediately (don't wait for buffer to finish)
        speaker.close(true);
      }
    } catch {
      // Ignore errors when stopping
    }
  }

  // Stop Web Audio API source if active
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
    } catch {}
    currentSourceNode = null;
  }
}

// ============================================================================
// Worker Thread Management
// ============================================================================

/**
 * Initialize the TTS utility process.
 * NOTE: Not supported with vite-plugin-electron build structure.
 * The utility process needs a separate entry point which vite-plugin-electron
 * doesn't provide. We use main thread generation instead.
 */
async function initializeTTSUtilityProcess(): Promise<boolean> {
  if (ttsUtilityProcess && utilityProcessReady) {
    console.log('[TTS] Utility process already ready');
    return true;
  }

  // Utility process not supported with vite-plugin-electron
  // Fall back to main thread generation
  return false;
}

/**
 * Generate speech using the utility process (non-blocking).
 */
function generateSpeechInUtilityProcess(
  text: string,
  speakerId: number,
  speed: number
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  return new Promise((resolve) => {
    if (!ttsUtilityProcess || !utilityProcessReady) {
      resolve(null);
      return;
    }

    const id = generationIdCounter++;

    // Set a timeout for this specific generation
    const timeout = setTimeout(() => {
      pendingGenerations.delete(id);
      console.error(`[TTS] Generation timeout for id ${id}`);
      resolve(null);
    }, 30000); // 30 second timeout per sentence

    pendingGenerations.set(id, (result) => {
      clearTimeout(timeout);
      if (result) {
        resolve({ samples: result.samples, sampleRate: result.sampleRate });
      } else {
        resolve(null);
      }
    });

    ttsUtilityProcess.postMessage({
      type: 'generate',
      id,
      text,
      speakerId,
      speed,
    });
  });
}

/**
 * Terminate the TTS utility process.
 * NOTE: Currently unused but kept for cleanup on app exit.
 */
export function terminateTTSUtilityProcess(): void {
  if (ttsUtilityProcess) {
    ttsUtilityProcess.kill();
    ttsUtilityProcess = null;
    utilityProcessReady = false;
    pendingGenerations.clear();
  }
}

// ============================================================================
// Sentence Splitting
// ============================================================================

/**
 * Split text into sentences for streaming TTS.
 * Handles common sentence endings while preserving abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  // Common abbreviations to not split on
  const abbreviations = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|Inc|Ltd|Corp|St|Ave|Blvd)\./gi;

  // Replace abbreviations with placeholder
  let processed = text.replace(abbreviations, (match) => match.replace('.', '\x00'));

  // Split on sentence endings (. ! ?) followed by space or end
  const sentences = processed
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/\x00/g, '.').trim())
    .filter(s => s.length > 0);

  // If no sentences found, return original text as single sentence
  if (sentences.length === 0 && text.trim().length > 0) {
    return [text.trim()];
  }

  return sentences;
}

// ============================================================================
// Streaming TTS
// ============================================================================

/**
 * Send streaming progress event to renderer.
 */
function sendStreamingEvent(
  event: 'start' | 'sentence-start' | 'sentence-end' | 'complete' | 'error',
  data?: { index?: number; total?: number; text?: string; durationMs?: number; error?: string }
): void {
  currentStreamWindow?.webContents.send('tts:streaming-progress', { event, ...data });
}

/**
 * Process the audio queue - generate and play sequentially.
 * NOTE: Currently unused, kept for alternative streaming implementation.
 */
export async function processStreamingQueue(): Promise<void> {
  if (isPlaybackActive || streamingAborted) return;

  isPlaybackActive = true;

  while (streamingQueue.length > 0 && !streamingAborted) {
    const chunk = streamingQueue.shift()!;

    sendStreamingEvent('sentence-start', {
      index: chunk.index,
      text: chunk.text,
    });

    try {
      await playAudio(chunk.samples, chunk.sampleRate);
      sendStreamingEvent('sentence-end', { index: chunk.index });
    } catch (error) {
      console.error('[TTS] Playback error:', error);
      if (!streamingAborted) {
        sendStreamingEvent('error', { error: String(error) });
      }
    }
  }

  isPlaybackActive = false;

  // If generation is done and queue is empty, signal completion
  if (!isStreamingActive && streamingQueue.length === 0 && !streamingAborted) {
    sendStreamingEvent('complete');
    isSpeaking = false;
  }
}

/**
 * Speak text with streaming - generates and plays sentence by sentence.
 * Uses worker thread to preload sentences while playing for seamless audio.
 */
async function speakStreaming(
  text: string,
  options?: TTSOptions,
  window?: BrowserWindow
): Promise<void> {
  // Stop any current speech
  if (isSpeaking) {
    stopStreaming();
  }

  // Auto-initialize TTS if using Kokoro voice and not yet initialized
  const voice = options?.voiceId ?? currentVoice;
  const speed = options?.speed ?? 1.0;
  const isKokoroVoice = voice && KOKORO_VOICES.some((v) => v.id === voice);
  if (isKokoroVoice && currentBackend !== 'sherpa-onnx') {
    console.log('[TTS] Auto-initializing Sherpa-ONNX for Kokoro voice');
    const initialized = await initializeSherpaOnnx();
    if (initialized) {
      currentBackend = 'sherpa-onnx';
    }
  }

  // Reset state
  streamingQueue = [];
  isStreamingActive = true;
  isPlaybackActive = false;
  streamingAborted = false;
  isSpeaking = true;
  currentStreamWindow = window ?? null;

  // Get speaker ID for worker
  let speakerId = 0;
  if (voice) {
    const kokoroVoice = KOKORO_VOICES.find((v) => v.id === voice);
    if (kokoroVoice) {
      speakerId = kokoroVoice.speakerId;
      setSherpaVoice(voice);
    }
  }

  // Split into sentences
  const sentences = splitIntoSentences(text);
  console.log(`[TTS] Streaming ${sentences.length} sentences`);

  sendStreamingEvent('start', { total: sentences.length });

  // Try to use utility process for parallel generation (doesn't block main thread)
  let useUtilityProcess = false;
  try {
    console.log('[TTS] Attempting to initialize utility process...');
    useUtilityProcess = await initializeTTSUtilityProcess();
    console.log(`[TTS] Utility process init result: ${useUtilityProcess}`);
  } catch (err) {
    console.error('[TTS] Utility process init error:', err);
    useUtilityProcess = false;
  }
  console.log(`[TTS] Using ${useUtilityProcess ? 'utility process (preloading)' : 'main thread (sequential)'}`);

  isPlaybackActive = true;

  if (useUtilityProcess) {
    // === UTILITY PROCESS MODE: True parallel preloading ===
    const generatedChunks: Map<number, AudioChunk> = new Map();
    const generatingPromises: Map<number, Promise<void>> = new Map();
    let nextToPlay = 0;
    let nextToGenerate = 0;

    const generateInUtilityProcess = async (index: number): Promise<void> => {
      if (streamingAborted || generatedChunks.has(index)) return;

      const sentence = sentences[index];
      console.log(`[TTS] Utility generating ${index + 1}/${sentences.length}: "${sentence.slice(0, 30)}..."`);

      const result = await generateSpeechInUtilityProcess(sentence, speakerId, speed);
      if (result && !streamingAborted) {
        generatedChunks.set(index, {
          samples: result.samples,
          sampleRate: result.sampleRate,
          text: sentence,
          index,
        });
      }
    };

    const preload = (): void => {
      const target = Math.min(nextToPlay + PRELOAD_AHEAD + 1, sentences.length);
      while (nextToGenerate < target) {
        const idx = nextToGenerate++;
        if (!generatingPromises.has(idx)) {
          generatingPromises.set(idx, generateInUtilityProcess(idx));
        }
      }
    };

    // Play sentences as they become ready
    while (nextToPlay < sentences.length && !streamingAborted) {
      preload();

      // Wait for current sentence
      while (!generatedChunks.has(nextToPlay) && !streamingAborted) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (streamingAborted) break;

      const chunk = generatedChunks.get(nextToPlay)!;
      generatedChunks.delete(nextToPlay);

      // Calculate duration in milliseconds
      const durationMs = Math.round((chunk.samples.length / chunk.sampleRate) * 1000);
      sendStreamingEvent('sentence-start', { index: nextToPlay, text: chunk.text, durationMs });

      try {
        await playAudio(chunk.samples, chunk.sampleRate);
        sendStreamingEvent('sentence-end', { index: nextToPlay });
      } catch (error) {
        console.error('[TTS] Playback error:', error);
      }

      nextToPlay++;
    }
  } else {
    // === MAIN THREAD MODE: Sequential generate-then-play ===
    // Generate one sentence, play it, then generate next (no preloading)
    for (let i = 0; i < sentences.length && !streamingAborted; i++) {
      const sentence = sentences[i];
      console.log(`[TTS] Generating ${i + 1}/${sentences.length}: "${sentence.slice(0, 30)}..."`);

      // Yield to event loop before blocking generation
      await new Promise(resolve => setImmediate(resolve));

      const result = generateSpeech(sentence, undefined, speed);
      if (!result || streamingAborted) continue;

      // Calculate duration in milliseconds
      const durationMs = Math.round((result.samples.length / result.sampleRate) * 1000);
      sendStreamingEvent('sentence-start', { index: i, text: sentence, durationMs });

      try {
        await playAudio(result.samples, result.sampleRate);
        sendStreamingEvent('sentence-end', { index: i });
      } catch (error) {
        console.error('[TTS] Playback error:', error);
      }
    }
  }

  isPlaybackActive = false;
  isStreamingActive = false;

  if (!streamingAborted) {
    sendStreamingEvent('complete');
  }

  isSpeaking = false;
}

/**
 * Stop streaming TTS.
 */
function stopStreaming(): void {
  streamingAborted = true;
  isStreamingActive = false;
  streamingQueue = [];
  stopAudioPlayback();

  if (currentStreamWindow) {
    sendStreamingEvent('complete');
    currentStreamWindow = null;
  }

  isSpeaking = false;
  console.log('[TTS] Streaming stopped');
}

// ============================================================================
// TTS Initialization
// ============================================================================

/**
 * Initialize the TTS system, preferring Sherpa-ONNX if available.
 */
export async function initializeTTS(
  window?: BrowserWindow
): Promise<TTSBackend> {
  const sendProgress = (event: TTSLoadingEvent) => {
    window?.webContents.send('tts:loading', event);
  };

  // Check if Kokoro model exists
  if (!kokoroModelExists()) {
    console.log('[TTS] Kokoro model not found, using say.js fallback');
    sendProgress({
      state: 'fallback',
      progress: 100,
      message: 'Using system voice (model not found)',
      backend: 'say.js',
    });
    currentBackend = 'say.js';
    return 'say.js';
  }

  // Try to initialize Sherpa-ONNX
  sendProgress({
    state: 'loading',
    progress: 0,
    message: 'Loading neural voice...',
  });

  try {
    // Try to load speaker module (optional - audio playback will use say.js fallback if not available)
    await loadSpeakerModule();

    const success = await initializeSherpaOnnx((progress, message) => {
      sendProgress({
        state: 'loading',
        progress,
        message,
      });
    });

    if (success) {
      currentBackend = 'sherpa-onnx';
      sendProgress({
        state: 'ready',
        progress: 100,
        message: 'Neural voice ready',
        backend: 'sherpa-onnx',
      });
      console.log('[TTS] Initialized with Sherpa-ONNX (Kokoro)');
      return 'sherpa-onnx';
    }
  } catch (error) {
    console.error('[TTS] Sherpa-ONNX initialization failed:', error);
  }

  // Fall back to say.js
  currentBackend = 'say.js';
  sendProgress({
    state: 'fallback',
    progress: 100,
    message: 'Using system voice (neural TTS failed)',
    backend: 'say.js',
  });
  console.log('[TTS] Falling back to say.js');
  return 'say.js';
}

// ============================================================================
// Voice Management
// ============================================================================

/**
 * Get available voices from both backends.
 */
async function getVoices(): Promise<VoiceInfo[]> {
  const voices: VoiceInfo[] = [];

  const addDefaultVoice = () => {
    // Always include default system voice
    if (!voices.some((v) => v.id === 'system:default')) {
      voices.push({
        id: 'system:default',
        name: 'System Default',
        language: 'en',
        sizeBytes: 0,
        backend: 'say.js',
      });
    }
  };

  // Always add Kokoro voices if the model exists (they're available even if backend not active)
  if (kokoroModelExists() || currentBackend === 'sherpa-onnx') {
    for (const voice of KOKORO_VOICES) {
      voices.push({
        id: voice.id,
        name: voice.name,
        language: voice.accent === 'british' ? 'en-GB' : 'en-US',
        sizeBytes: 0,
        backend: 'sherpa-onnx',
      });
    }
  }

  // Add system voices with timeout protection
  return new Promise((resolve) => {
    try {
      const getVoicesFunc = say.getInstalledVoices as unknown as (
        cb: (err: Error | null, sysVoices: string[] | null) => void
      ) => void;

      // Set a timeout in case the callback never fires
      const timeout = setTimeout(() => {
        console.log('[TTS] getInstalledVoices timeout, resolving with current voices');
        addDefaultVoice();
        resolve(voices);
      }, 2000);

      getVoicesFunc((err, sysVoices) => {
        clearTimeout(timeout);
        if (!err && sysVoices) {
          for (const voice of sysVoices) {
            voices.push({
              id: `system:${voice}`,
              name: `${voice} (System)`,
              language: 'en',
              sizeBytes: 0,
              backend: 'say.js',
            });
          }
        }
        addDefaultVoice();
        resolve(voices);
      });
    } catch (err) {
      console.error('[TTS] Error getting system voices:', err);
      addDefaultVoice();
      resolve(voices);
    }
  });
}

/**
 * Load/select a voice.
 */
async function loadVoice(voiceId: string): Promise<boolean> {
  // Check if it's a Kokoro voice
  const kokoroVoice = KOKORO_VOICES.find((v) => v.id === voiceId);
  if (kokoroVoice && currentBackend === 'sherpa-onnx') {
    setSherpaVoice(voiceId);
    currentVoice = voiceId;
    console.log(`[TTS] Voice set to Kokoro: ${kokoroVoice.name}`);
    return true;
  }

  // Check if it's a system voice
  if (voiceId.startsWith('system:')) {
    const sysVoice = voiceId.replace('system:', '');
    currentVoice = sysVoice === 'default' ? null : sysVoice;
    console.log(`[TTS] Voice set to system: ${currentVoice ?? 'default'}`);
    return true;
  }

  // Try as raw voice name for backward compatibility
  currentVoice = voiceId === 'default' ? null : voiceId;
  console.log(`[TTS] Voice set to: ${currentVoice ?? 'system default'}`);
  return true;
}

// ============================================================================
// Speech Synthesis
// ============================================================================

/**
 * Speak text using the appropriate backend.
 */
async function speak(text: string, options?: TTSOptions): Promise<void> {
  if (isSpeaking) {
    stop();
  }

  isSpeaking = true;
  const voice = options?.voiceId ?? currentVoice;
  const speed = options?.speed ?? 1.0;

  console.log(`[TTS] Speaking (${currentBackend}): ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);

  try {
    // Determine which backend to use based on voice selection
    const isKokoroVoice = KOKORO_VOICES.some((v) => v.id === voice);
    const useSherpa = currentBackend === 'sherpa-onnx' && (isKokoroVoice || !voice?.startsWith('system:'));

    if (useSherpa && isSherpaReady()) {
      await speakWithSherpaOnnx(text, voice ?? undefined, speed);
    } else {
      await speakWithSayJs(text, voice ?? undefined, speed);
    }
  } finally {
    isSpeaking = false;
  }
}

/**
 * Speak using Sherpa-ONNX (Kokoro).
 */
async function speakWithSherpaOnnx(
  text: string,
  voiceId?: string,
  speed?: number
): Promise<void> {
  // Set voice if specified
  if (voiceId) {
    const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
    if (voice) {
      setSherpaVoice(voiceId);
    }
  }

  // Use sync generation (async callback doesn't work reliably)
  const result = generateSpeech(text, undefined, speed);
  if (!result) {
    throw new Error('Speech generation failed');
  }

  await playAudio(result.samples, result.sampleRate);
}

/**
 * Speak using say.js (system TTS).
 */
async function speakWithSayJs(
  text: string,
  voiceId?: string,
  speed?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Extract system voice name if prefixed
    let voice = voiceId;
    if (voice?.startsWith('system:')) {
      voice = voice.replace('system:', '');
      if (voice === 'default') {
        voice = undefined;
      }
    }

    say.speak(text, voice, speed, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Stop current speech.
 */
function stop(): void {
  if (isSpeaking) {
    // Stop streaming TTS if active
    if (isStreamingActive || isPlaybackActive) {
      stopStreaming();
    }

    // Stop Sherpa-ONNX audio playback
    stopAudioPlayback();

    // Stop say.js
    say.stop();

    isSpeaking = false;
    console.log('[TTS] Stopped');
  }
}

/**
 * Check if TTS is loaded.
 */
function isLoaded(): boolean {
  return true; // At minimum, say.js is always available
}

/**
 * Get the current TTS backend.
 */
export function getBackend(): TTSBackend {
  return currentBackend;
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

export function registerTTSHandlers(): void {
  ipcMain.handle('tts:load-voice', async (_event, voiceId: string) => {
    return loadVoice(voiceId);
  });

  ipcMain.handle('tts:speak', async (_event, text: string, options?: TTSOptions) => {
    return speak(text, options);
  });

  ipcMain.handle('tts:speak-streaming', async (event, text: string, options?: TTSOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    return speakStreaming(text, options, window);
  });

  ipcMain.on('tts:stop', () => {
    stop();
  });

  ipcMain.handle('tts:get-voices', async () => {
    return getVoices();
  });

  ipcMain.handle('tts:is-loaded', async () => {
    return isLoaded();
  });

  ipcMain.handle('tts:get-backend', async () => {
    return getBackend();
  });

  console.log('[TTS] Handlers registered (dual-backend: sherpa-onnx + say.js)');
}
