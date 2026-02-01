/**
 * Whisper Speech-to-Text IPC Handler
 *
 * Handles STT using OpenAI Whisper model via nodejs-whisper.
 */

import { ipcMain, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getWhisperService,
  TranscriptionOptions,
  WhisperModel,
  WhisperModelInfo,
  WHISPER_MODELS
} from '../whisperService';

// ============================================================================
// Types
// ============================================================================

export interface WhisperTranscribeRequest {
  audioFilePath: string;
  options?: TranscriptionOptions;
}

export interface WhisperTranscribeResponse {
  success: boolean;
  result?: Array<{
    start: string;
    end: string;
    speech: string;
  }>;
  text?: string;
  error?: string;
}

export interface WhisperModelStatus {
  currentModel: WhisperModel;
  availableModels: WhisperModel[];
  allModels: WhisperModelInfo[];
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

export function registerWhisperHandlers(): void {
  // Get available models and current model
  ipcMain.handle('whisper:get-models', (): WhisperModelStatus => {
    const service = getWhisperService();
    return {
      currentModel: service.getModel(),
      availableModels: service.getAvailableModels(),
      allModels: WHISPER_MODELS,
    };
  });

  // Set the model to use for transcription
  ipcMain.handle('whisper:set-model', async (_event, model: WhisperModel): Promise<{ success: boolean; error?: string }> => {
    try {
      const service = getWhisperService();
      service.setModel(model);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Check if model is available
  ipcMain.handle('whisper:check-model', () => {
    const service = getWhisperService();
    return {
      hasModel: service.hasModel(),
      modelPath: service.getModelFilePath(),
      modelName: service.getModel(),
    };
  });

  // Transcribe audio file - returns full result with timestamps
  ipcMain.handle(
    'whisper:transcribe',
    async (_event, request: WhisperTranscribeRequest): Promise<WhisperTranscribeResponse> => {
      try {
        const { audioFilePath, options = {} } = request;
        const service = getWhisperService();

        const result = await service.transcribe(audioFilePath, options);

        return {
          success: true,
          result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Transcribe audio file - returns plain text only
  ipcMain.handle(
    'whisper:transcribe-to-text',
    async (_event, request: WhisperTranscribeRequest): Promise<WhisperTranscribeResponse> => {
      try {
        const { audioFilePath, options = {} } = request;
        const service = getWhisperService();

        const text = await service.transcribeToText(audioFilePath, options);

        return {
          success: true,
          text,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Convert audio to WAV format (requires ffmpeg)
  ipcMain.handle(
    'whisper:convert-to-wav',
    async (_event, inputPath: string, outputPath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const service = getWhisperService();
        await service.convertToWav(inputPath, outputPath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Transcribe audio blob from renderer (for voice recording)
  ipcMain.handle(
    'whisper:transcribe-blob',
    async (_event, audioData: { buffer: number[]; mimeType: string }): Promise<WhisperTranscribeResponse> => {
      try {
        const { buffer, mimeType } = audioData;
        const service = getWhisperService();

        // Create temp directory
        const tempDir = path.join(app.getPath('userData'), 'temp', 'audio');
        await fs.mkdir(tempDir, { recursive: true });

        // Save audio blob to temp file
        const timestamp = Date.now();
        let inputPath: string;

        if (mimeType === 'audio/webm' || mimeType.includes('webm')) {
          inputPath = path.join(tempDir, `recording_${timestamp}.webm`);
        } else {
          inputPath = path.join(tempDir, `recording_${timestamp}.wav`);
        }

        await fs.writeFile(inputPath, Buffer.from(buffer));

        // Check if we need to convert to WAV
        let wavPath = inputPath;
        if (!inputPath.endsWith('.wav')) {
          wavPath = path.join(tempDir, `recording_${timestamp}.wav`);
          await service.convertToWav(inputPath, wavPath);
        }

        // Transcribe
        const text = await service.transcribeToText(wavPath, { language: 'en' });

        // Clean up temp files
        try {
          await fs.unlink(inputPath);
          if (wavPath !== inputPath) {
            await fs.unlink(wavPath);
          }
        } catch {
          // Ignore cleanup errors
        }

        return {
          success: true,
          text,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );
}
