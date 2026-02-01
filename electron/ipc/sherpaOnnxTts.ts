/**
 * Sherpa-ONNX TTS Integration
 *
 * High-quality neural TTS using the Kokoro-82M model via sherpa-onnx.
 * Based on fntm implementation.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface KokoroVoice {
  id: string;
  name: string;
  speakerId: number;
  gender: 'female' | 'male';
  accent: 'american' | 'british';
}

export interface SherpaOnxConfig {
  modelPath: string;
  tokensPath: string;
  voicesPath: string;
  dataDirPath: string;
}

// ============================================================================
// Constants - Kokoro Voices
// ============================================================================

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: 'af_alloy', name: 'Alloy (Female)', speakerId: 0, gender: 'female', accent: 'american' },
  { id: 'am_adam', name: 'Adam (Male)', speakerId: 1, gender: 'male', accent: 'american' },
  { id: 'af_bella', name: 'Bella (Female)', speakerId: 2, gender: 'female', accent: 'american' },
  { id: 'am_michael', name: 'Michael (Male)', speakerId: 3, gender: 'male', accent: 'american' },
  { id: 'af_nicole', name: 'Nicole (Female)', speakerId: 4, gender: 'female', accent: 'american' },
  { id: 'am_liam', name: 'Liam (Male)', speakerId: 5, gender: 'male', accent: 'american' },
  { id: 'af_sarah', name: 'Sarah (Female)', speakerId: 6, gender: 'female', accent: 'american' },
  { id: 'bf_emma', name: 'Emma (British F)', speakerId: 7, gender: 'female', accent: 'british' },
  { id: 'af_sky', name: 'Sky (Female)', speakerId: 8, gender: 'female', accent: 'american' },
  { id: 'bf_isabella', name: 'Isabella (British F)', speakerId: 9, gender: 'female', accent: 'british' },
  { id: 'bm_george', name: 'George (British M)', speakerId: 10, gender: 'male', accent: 'british' },
];

// Default voice
export const DEFAULT_KOKORO_VOICE = KOKORO_VOICES[0]; // Alloy

// ============================================================================
// Module State
// ============================================================================

// TTS request parameters
interface TtsRequest {
  text: string;
  sid: number;
  speed: number;
  enableExternalBuffer?: boolean;
}

// Native module interface (low-level C++ bindings)
interface SherpaOnnxNative {
  createOfflineTts: (config: object) => unknown;
  getOfflineTtsSampleRate: (tts: unknown) => number;
  getOfflineTtsNumSpeakers: (tts: unknown) => number;
  offlineTtsGenerate: (tts: unknown, request: TtsRequest) => {
    samples: Float32Array;
    sampleRate: number;
  };
  offlineTtsGenerateAsync: (
    tts: unknown,
    request: TtsRequest,
    callback: (result: { samples: Float32Array; sampleRate: number }) => void
  ) => void;
}

let nativeModule: SherpaOnnxNative | null = null;
let ttsHandle: unknown = null;
let isInitialized = false;
let currentSpeakerId = DEFAULT_KOKORO_VOICE.speakerId;

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the platform-specific native module directory name.
 */
function getPlatformDir(): string {
  const platform = process.platform === 'win32' ? 'win' : process.platform;
  const arch = process.arch;
  return `sherpa-onnx-${platform}-${arch}`;
}

/**
 * Load sherpa-onnx-node by directly requiring the native module from the correct path.
 */
function loadSherpaOnnxModule(): SherpaOnnxNative | null {
  const appPath = app.getAppPath();
  const platformDir = getPlatformDir();
  const nativeModulePath = path.join(appPath, 'node_modules', platformDir, 'sherpa-onnx.node');
  const nativeModuleDir = path.dirname(nativeModulePath);

  if (!fs.existsSync(nativeModulePath)) {
    console.warn(`[SherpaOnnx] Native module not found at: ${nativeModulePath}`);
    return null;
  }

  console.log(`[SherpaOnnx] Loading native module from: ${nativeModulePath}`);

  // Set library path for dynamic library loading on macOS/Linux
  if (process.platform === 'darwin') {
    const currentPath = process.env.DYLD_LIBRARY_PATH || '';
    if (!currentPath.includes(nativeModuleDir)) {
      process.env.DYLD_LIBRARY_PATH = nativeModuleDir + (currentPath ? ':' + currentPath : '');
      console.log(`[SherpaOnnx] Set DYLD_LIBRARY_PATH to include: ${nativeModuleDir}`);
    }
  } else if (process.platform === 'linux') {
    const currentPath = process.env.LD_LIBRARY_PATH || '';
    if (!currentPath.includes(nativeModuleDir)) {
      process.env.LD_LIBRARY_PATH = nativeModuleDir + (currentPath ? ':' + currentPath : '');
      console.log(`[SherpaOnnx] Set LD_LIBRARY_PATH to include: ${nativeModuleDir}`);
    }
  }

  try {
    // Load the native addon directly
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeAddon = require(nativeModulePath) as SherpaOnnxNative;
    console.log(`[SherpaOnnx] Native module loaded, available functions: ${Object.keys(nativeAddon).filter(k => k.includes('Tts')).join(', ')}`);
    return nativeAddon;
  } catch (err) {
    console.error(`[SherpaOnnx] Failed to load native module:`, err);
    return null;
  }
}

/**
 * Get the path to the Kokoro TTS model directory.
 */
export function getKokoroModelPath(): string {
  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, the models are in the project's resources directory
    return path.join(process.cwd(), 'resources', 'models', 'kokoro-tts');
  }

  // In production, extraResources are in the resources folder next to the app
  return path.join(process.resourcesPath, 'models', 'kokoro-tts');
}

/**
 * Check if the Kokoro model files exist.
 */
export function kokoroModelExists(): boolean {
  const modelPath = getKokoroModelPath();
  const requiredFiles = ['model.onnx', 'voices.bin', 'tokens.txt'];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(modelPath, file))) {
      console.log(`[SherpaOnnx] Missing model file: ${file}`);
      return false;
    }
  }

  return true;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize Sherpa-ONNX TTS with Kokoro model.
 */
export async function initializeSherpaOnnx(
  onProgress?: (progress: number, message: string) => void
): Promise<boolean> {
  if (isInitialized && ttsHandle) {
    console.log('[SherpaOnnx] Already initialized');
    return true;
  }

  console.log('[SherpaOnnx] Initializing TTS...');
  onProgress?.(0, 'Checking TTS model...');

  // Check if model exists
  if (!kokoroModelExists()) {
    console.warn('[SherpaOnnx] Kokoro model not found, cannot initialize');
    return false;
  }

  const modelDir = getKokoroModelPath();
  console.log(`[SherpaOnnx] Model directory: ${modelDir}`);

  try {
    onProgress?.(20, 'Loading sherpa-onnx...');

    // Load the native module directly (bypasses sherpa-onnx-node's path resolution)
    const loadedModule = loadSherpaOnnxModule();
    if (!loadedModule) {
      throw new Error('Failed to load sherpa-onnx native module');
    }
    nativeModule = loadedModule;

    onProgress?.(50, 'Creating TTS engine...');

    // Create TTS configuration as JSON string (the native API expects a JSON config)
    const config = {
      model: {
        kokoro: {
          model: path.join(modelDir, 'model.onnx'),
          voices: path.join(modelDir, 'voices.bin'),
          tokens: path.join(modelDir, 'tokens.txt'),
          dataDir: path.join(modelDir, 'espeak-ng-data'),
          lengthScale: 1.0,
        },
        debug: 0,
        numThreads: 2,
        provider: 'cpu',
      },
      maxNumSentences: 1,
    };

    ttsHandle = nativeModule!.createOfflineTts(config);

    if (!ttsHandle) {
      throw new Error('Failed to create TTS instance');
    }

    const sampleRate = nativeModule!.getOfflineTtsSampleRate(ttsHandle);
    const numSpeakers = nativeModule!.getOfflineTtsNumSpeakers(ttsHandle);

    onProgress?.(100, 'TTS ready');
    isInitialized = true;

    console.log('[SherpaOnnx] TTS initialized successfully');
    console.log(`[SherpaOnnx] Sample rate: ${sampleRate}, Speakers: ${numSpeakers}`);

    return true;
  } catch (error) {
    console.error('[SherpaOnnx] Failed to initialize:', error);
    isInitialized = false;
    ttsHandle = null;
    nativeModule = null;
    return false;
  }
}

// ============================================================================
// Speech Generation
// ============================================================================

/**
 * Generate speech audio from text (synchronous - blocks main thread).
 * Returns Float32Array of audio samples at the TTS sample rate.
 */
export function generateSpeech(
  text: string,
  speakerId?: number,
  speed?: number
): { samples: Float32Array; sampleRate: number } | null {
  if (!nativeModule || !ttsHandle || !isInitialized) {
    console.error('[SherpaOnnx] TTS not initialized');
    return null;
  }

  const speaker = speakerId ?? currentSpeakerId;
  const speechSpeed = speed ?? 1.0;

  console.log(`[SherpaOnnx] Generating speech for: "${text.slice(0, 50)}..." (speaker: ${speaker})`);

  try {
    const audio = nativeModule.offlineTtsGenerate(ttsHandle, {
      text,
      sid: speaker,
      speed: speechSpeed,
      enableExternalBuffer: false, // Required for Electron compatibility
    });

    console.log(`[SherpaOnnx] Generated ${audio.samples.length} samples at ${audio.sampleRate}Hz`);

    return {
      samples: audio.samples,
      sampleRate: audio.sampleRate,
    };
  } catch (error) {
    console.error('[SherpaOnnx] Speech generation failed:', error);
    return null;
  }
}

/**
 * Generate speech audio from text (async - non-blocking).
 */
export function generateSpeechAsync(
  text: string,
  speakerId?: number,
  speed?: number
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  return new Promise((resolve) => {
    if (!nativeModule || !ttsHandle || !isInitialized) {
      console.error('[SherpaOnnx] TTS not initialized');
      resolve(null);
      return;
    }

    const speaker = speakerId ?? currentSpeakerId;
    const speechSpeed = speed ?? 1.0;

    console.log(`[SherpaOnnx] Generating speech async for: "${text.slice(0, 50)}..." (speaker: ${speaker})`);

    try {
      // Check if async function exists and try it
      if (typeof nativeModule.offlineTtsGenerateAsync === 'function') {
        console.log('[SherpaOnnx] Using offlineTtsGenerateAsync');
        nativeModule.offlineTtsGenerateAsync(
          ttsHandle,
          {
            text,
            sid: speaker,
            speed: speechSpeed,
            enableExternalBuffer: false,
          },
          (audio) => {
            console.log(`[SherpaOnnx] Async callback received: ${audio?.samples?.length} samples`);
            if (audio && audio.samples) {
              resolve({
                samples: audio.samples,
                sampleRate: audio.sampleRate,
              });
            } else {
              console.error('[SherpaOnnx] Async callback received invalid audio');
              resolve(null);
            }
          }
        );
      } else {
        // Fallback to sync in a setImmediate to not block
        console.log('[SherpaOnnx] offlineTtsGenerateAsync not available, using sync fallback');
        setImmediate(() => {
          try {
            const audio = nativeModule!.offlineTtsGenerate(ttsHandle, {
              text,
              sid: speaker,
              speed: speechSpeed,
              enableExternalBuffer: false,
            });
            console.log(`[SherpaOnnx] Sync generated ${audio.samples.length} samples`);
            resolve({
              samples: audio.samples,
              sampleRate: audio.sampleRate,
            });
          } catch (err) {
            console.error('[SherpaOnnx] Sync fallback failed:', err);
            resolve(null);
          }
        });
      }
    } catch (error) {
      console.error('[SherpaOnnx] Speech generation failed:', error);
      resolve(null);
    }
  });
}

// ============================================================================
// Voice Management
// ============================================================================

/**
 * Set the current speaker/voice.
 */
export function setVoice(voiceId: string): boolean {
  const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
  if (!voice) {
    console.warn(`[SherpaOnnx] Unknown voice: ${voiceId}`);
    return false;
  }

  currentSpeakerId = voice.speakerId;
  console.log(`[SherpaOnnx] Voice set to: ${voice.name} (speaker ${voice.speakerId})`);
  return true;
}

/**
 * Get the current voice ID.
 */
export function getCurrentVoiceId(): string {
  const voice = KOKORO_VOICES.find((v) => v.speakerId === currentSpeakerId);
  return voice?.id ?? DEFAULT_KOKORO_VOICE.id;
}

/**
 * Get available Kokoro voices.
 */
export function getVoices(): KokoroVoice[] {
  return [...KOKORO_VOICES];
}

// ============================================================================
// Status
// ============================================================================

/**
 * Check if Sherpa-ONNX TTS is initialized and ready.
 */
export function isReady(): boolean {
  return isInitialized && ttsHandle !== null && nativeModule !== null;
}

/**
 * Get the TTS sample rate.
 */
export function getSampleRate(): number {
  if (!nativeModule || !ttsHandle) return 24000;
  return nativeModule.getOfflineTtsSampleRate(ttsHandle);
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up Sherpa-ONNX resources.
 */
export function cleanup(): void {
  ttsHandle = null;
  nativeModule = null;
  isInitialized = false;
  console.log('[SherpaOnnx] Cleaned up');
}
