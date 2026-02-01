// Type declaration for whisper-node
declare module 'whisper-node' {
  interface WhisperOptions {
    language?: string;
    gen_file_txt?: boolean;
    gen_file_subtitle?: boolean;
    gen_file_vtt?: boolean;
    word_timestamps?: boolean;
  }

  interface WhisperNodeOptions {
    modelName?: string;
    modelPath?: string;
    whisperOptions?: WhisperOptions;
  }

  interface WhisperResult {
    start: string;
    end: string;
    speech: string;
  }

  const whisper: (filePath: string, options?: WhisperNodeOptions) => Promise<WhisperResult[]>;
  export default whisper;
}
