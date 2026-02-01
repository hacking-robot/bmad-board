import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import whisper from 'whisper-node';

export type WhisperModel = 'base.en' | 'small.en' | 'large-v3-turbo'

export interface TranscriptionOptions {
  language?: string;
  outputInJson?: boolean;
  outputInSrt?: boolean;
  outputInVtt?: boolean;
  outputInText?: boolean;
  wordTimestamps?: boolean;
  translateToEnglish?: boolean;
}

export interface TranscriptionResult {
  start: string;
  end: string;
  speech: string;
}

export interface WhisperModelInfo {
  id: WhisperModel
  name: string
  size: string
  description: string
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  {
    id: 'base.en',
    name: 'Base (English)',
    size: '~142 MB',
    description: 'Fast transcription with good accuracy for English coding discussions'
  },
  {
    id: 'small.en',
    name: 'Small (English)',
    size: '~466 MB',
    description: 'Better accuracy for technical terms, still fast'
  },
  {
    id: 'large-v3-turbo',
    name: 'Large v3 Turbo',
    size: '~1.5 GB',
    description: 'Best accuracy, handles complex technical vocabulary well'
  }
]

class WhisperService {
  private modelName: WhisperModel;
  private whisperCppPath: string;

  constructor(modelName: WhisperModel = 'base.en') {
    // Store model in whisper.cpp directory for whisper-node
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    // whisper-node looks for models in node_modules/whisper-node/lib/whisper.cpp/models/
    if (isDev) {
      this.whisperCppPath = path.join(process.cwd(), 'node_modules', 'whisper-node', 'lib', 'whisper.cpp');
    } else {
      this.whisperCppPath = path.join(app.getPath('userData'), 'whisper-node', 'lib', 'whisper.cpp');
    }

    this.modelName = modelName;

    // Ensure model directory exists
    const fullPath = path.join(this.whisperCppPath, 'models');
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  /**
   * Set the model to use for transcription
   */
  setModel(modelName: WhisperModel): void {
    this.modelName = modelName;
  }

  /**
   * Get the current model name
   */
  getModel(): WhisperModel {
    return this.modelName;
  }

  /**
   * Get the full path to the GGML model file (for existence checks)
   */
  private getFullModelPath(modelName?: WhisperModel): string {
    const name = modelName || this.modelName;
    const fileName = name === 'large-v3-turbo' ? 'ggml-large.bin' : `ggml-${name}.bin`;
    return path.join(this.whisperCppPath, 'models', fileName);
  }

  /**
   * Get the path to the GGML model file
   */
  getModelFilePath(): string {
    return this.getFullModelPath();
  }

  /**
   * Check if the model file exists
   */
  hasModel(): boolean {
    return fs.existsSync(this.getFullModelPath());
  }

  /**
   * Check which models are available
   */
  getAvailableModels(): WhisperModel[] {
    return WHISPER_MODELS.filter(model => {
      const fileName = model.id === 'large-v3-turbo' ? 'ggml-large.bin' : `ggml-${model.id}.bin`;
      const modelPath = path.join(this.whisperCppPath, 'models', fileName);
      return fs.existsSync(modelPath);
    }).map(model => model.id);
  }

  /**
   * Transcribe an audio file
   * @param audioFilePath Path to the audio file (WAV format, 16kHz recommended)
   * @param options Transcription options
   * @returns Promise with transcription results
   */
  async transcribe(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult[]> {
    const {
      language = 'auto',
      outputInSrt = false,
      outputInVtt = false,
      outputInText = false,
      wordTimestamps = false,
    } = options;

    const modelFile = this.getFullModelPath();

    if (!this.hasModel()) {
      throw new Error(
        `Whisper model not found at ${modelFile}. Please download the model first.`
      );
    }

    // whisper-node's shell.js already changes to the whisper.cpp directory
    // So model paths must be relative to that directory: ./models/ggml-xxx.bin
    const modelNameForWhisper = this.modelName === 'large-v3-turbo' ? 'large' : this.modelName;
    const modelFileName = modelNameForWhisper === 'large' ? 'ggml-large.bin' : `ggml-${modelNameForWhisper}.bin`;
    const relativeModelPath = `./models/${modelFileName}`;

    try {
      // whisper-node returns array directly
      const result = await whisper(audioFilePath, {
        modelPath: relativeModelPath,
        whisperOptions: {
          language,
          gen_file_txt: outputInText,
          gen_file_subtitle: outputInSrt,
          gen_file_vtt: outputInVtt,
          word_timestamps: wordTimestamps,
        }
      });

      return result as TranscriptionResult[];
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Transcribe and return just the text content (concatenated)
   * @param audioFilePath Path to the audio file
   * @param options Transcription options
   * @returns Promise with the full transcript text
   */
  async transcribeToText(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    const result = await this.transcribe(audioFilePath, options);
    return result.map((r) => r.speech).join(' ');
  }

  /**
   * Convert audio to WAV format (16kHz) required by Whisper
   * This requires ffmpeg to be installed on the system
   * @param inputPath Input audio file path
   * @param outputPath Output WAV file path
   */
  async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    const { execa } = await import('execa');

    try {
      await execa('ffmpeg', ['-i', inputPath, '-ar', '16000', '-ac', '1', outputPath]);
    } catch (error) {
      throw new Error(
        `Failed to convert audio: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Singleton instance
let whisperService: WhisperService | null = null;

export function getWhisperService(modelName?: WhisperModel): WhisperService {
  if (!whisperService) {
    whisperService = new WhisperService(modelName);
  } else if (modelName) {
    whisperService.setModel(modelName);
  }
  return whisperService;
}

export { WhisperService };
