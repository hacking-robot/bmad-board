/**
 * TTS Utility Process
 *
 * Runs TTS generation in a separate Electron utility process to avoid blocking the main process.
 * This is the recommended way to run CPU-intensive tasks in Electron.
 */

import * as path from 'path';

// Types
interface TtsRequest {
  text: string;
  sid: number;
  speed: number;
  enableExternalBuffer?: boolean;
}

// Native module interface
interface SherpaOnnxNative {
  createOfflineTts: (config: object) => unknown;
  getOfflineTtsSampleRate: (tts: unknown) => number;
  getOfflineTtsNumSpeakers: (tts: unknown) => number;
  offlineTtsGenerate: (tts: unknown, request: TtsRequest) => {
    samples: Float32Array;
    sampleRate: number;
  };
}

let nativeModule: SherpaOnnxNative | null = null;
let ttsHandle: unknown = null;

/**
 * Initialize the TTS engine.
 */
function initialize(modelDir: string, nativeModulePath: string): boolean {
  try {
    console.log(`[TTS Utility] Loading native module from: ${nativeModulePath}`);

    // Set library path for dynamic library loading
    const nativeModuleDir = path.dirname(nativeModulePath);
    if (process.platform === 'darwin') {
      process.env.DYLD_LIBRARY_PATH = nativeModuleDir + (process.env.DYLD_LIBRARY_PATH ? ':' + process.env.DYLD_LIBRARY_PATH : '');
    } else if (process.platform === 'linux') {
      process.env.LD_LIBRARY_PATH = nativeModuleDir + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeModule = require(nativeModulePath) as SherpaOnnxNative;

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

    ttsHandle = nativeModule.createOfflineTts(config);

    if (!ttsHandle) {
      throw new Error('Failed to create TTS handle');
    }

    const sampleRate = nativeModule.getOfflineTtsSampleRate(ttsHandle);
    const numSpeakers = nativeModule.getOfflineTtsNumSpeakers(ttsHandle);

    console.log(`[TTS Utility] Initialized: ${sampleRate}Hz, ${numSpeakers} speakers`);
    return true;
  } catch (error) {
    console.error('[TTS Utility] Init failed:', error);
    return false;
  }
}

/**
 * Generate speech for the given text.
 */
function generate(text: string, speakerId: number, speed: number): { samples: Float32Array; sampleRate: number } | null {
  if (!nativeModule || !ttsHandle) {
    console.error('[TTS Utility] Not initialized');
    return null;
  }

  try {
    console.log(`[TTS Utility] Generating: "${text.slice(0, 30)}..."`);
    const audio = nativeModule.offlineTtsGenerate(ttsHandle, {
      text,
      sid: speakerId,
      speed,
      enableExternalBuffer: false,
    });
    console.log(`[TTS Utility] Generated ${audio.samples.length} samples`);
    return audio;
  } catch (error) {
    console.error('[TTS Utility] Generation failed:', error);
    return null;
  }
}

// Handle messages from parent process
process.parentPort?.on('message', (e) => {
  const message = e.data;

  switch (message.type) {
    case 'init': {
      const success = initialize(message.modelDir, message.nativeModulePath);
      process.parentPort?.postMessage({ type: 'init-result', success });
      break;
    }
    case 'generate': {
      const result = generate(message.text, message.speakerId, message.speed);
      if (result) {
        process.parentPort?.postMessage({
          type: 'result',
          id: message.id,
          samples: Array.from(result.samples), // Convert to array for IPC
          sampleRate: result.sampleRate,
        });
      } else {
        process.parentPort?.postMessage({
          type: 'error',
          id: message.id,
          error: 'Generation failed',
        });
      }
      break;
    }
  }
});

console.log('[TTS Utility] Process started');
