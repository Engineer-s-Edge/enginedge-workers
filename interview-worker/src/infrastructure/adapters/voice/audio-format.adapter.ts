/**
 * Audio Format Adapter
 *
 * Handles audio format conversion, sample rate conversion, and channel conversion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface AudioFormat {
  format: 'pcm' | 'wav' | 'mp3' | 'flac' | 'ogg';
  sampleRate: number;
  channels: number;
  bitDepth?: number;
}

@Injectable()
export class AudioFormatAdapter {
  private readonly logger = new Logger(AudioFormatAdapter.name);
  private readonly ffmpegPath?: string;
  private useFfmpeg: boolean = false;
  private ffmpegCheckPromise: Promise<boolean> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.ffmpegPath = this.configService.get<string>('FFMPEG_PATH') || 'ffmpeg';
    // Initialize asynchronously
    this.ffmpegCheckPromise = this.checkFfmpegAvailable().then((available) => {
      this.useFfmpeg = available;
      return available;
    });
  }

  private async ensureFfmpegChecked(): Promise<boolean> {
    if (this.ffmpegCheckPromise) {
      await this.ffmpegCheckPromise;
    }
    return this.useFfmpeg;
  }

  /**
   * Convert audio format
   */
  async convertFormat(
    audioBuffer: Buffer,
    fromFormat: string,
    toFormat: string,
  ): Promise<Buffer> {
    if (fromFormat.toLowerCase() === toFormat.toLowerCase()) {
      return audioBuffer;
    }

    const useFfmpeg = await this.ensureFfmpegChecked();
    if (useFfmpeg) {
      return await this.convertWithFfmpeg(audioBuffer, fromFormat, toFormat);
    } else {
      // Fallback to basic conversion (limited support)
      return await this.convertBasic(audioBuffer, fromFormat, toFormat);
    }
  }

  /**
   * Convert sample rate
   */
  async convertSampleRate(
    audioBuffer: Buffer,
    fromRate: number,
    toRate: number,
  ): Promise<Buffer> {
    if (fromRate === toRate) {
      return audioBuffer;
    }

    const useFfmpeg = await this.ensureFfmpegChecked();
    if (useFfmpeg) {
      return await this.convertSampleRateWithFfmpeg(
        audioBuffer,
        fromRate,
        toRate,
      );
    } else {
      // Fallback: return as-is (no conversion)
      this.logger.warn(
        `Sample rate conversion not available without ffmpeg. Returning original audio.`,
      );
      return audioBuffer;
    }
  }

  /**
   * Convert channels (mono/stereo)
   */
  async convertChannels(
    audioBuffer: Buffer,
    fromChannels: number,
    toChannels: number,
  ): Promise<Buffer> {
    if (fromChannels === toChannels) {
      return audioBuffer;
    }

    const useFfmpeg = await this.ensureFfmpegChecked();
    if (useFfmpeg) {
      return await this.convertChannelsWithFfmpeg(
        audioBuffer,
        fromChannels,
        toChannels,
      );
    } else {
      // Fallback: return as-is
      this.logger.warn(
        `Channel conversion not available without ffmpeg. Returning original audio.`,
      );
      return audioBuffer;
    }
  }

  /**
   * Detect audio format
   */
  async detectFormat(audioBuffer: Buffer): Promise<AudioFormat> {
    // Try to detect by magic bytes
    if (audioBuffer.length >= 4) {
      const header = audioBuffer.slice(0, 4).toString('ascii');

      if (header.startsWith('RIFF')) {
        // WAV file
        const sampleRate = audioBuffer.readUInt32LE(24);
        const channels = audioBuffer.readUInt16LE(22);
        return {
          format: 'wav',
          sampleRate,
          channels,
          bitDepth: audioBuffer.readUInt16LE(34),
        };
      } else if (header.startsWith('ID3') || audioBuffer[0] === 0xff) {
        // MP3 file
        return {
          format: 'mp3',
          sampleRate: 44100, // Default, would need to parse MP3 header
          channels: 2,
        };
      } else if (header.startsWith('fLaC')) {
        // FLAC file
        return {
          format: 'flac',
          sampleRate: 44100, // Would need to parse FLAC header
          channels: 2,
        };
      }
    }

    // Default to PCM
    return {
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
    };
  }

  /**
   * Check if ffmpeg is available
   */
  private async checkFfmpegAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.ffmpegPath} -version`);
      return true;
    } catch {
      this.logger.warn('ffmpeg not available, using basic audio processing');
      return false;
    }
  }

  /**
   * Convert using ffmpeg
   */
  private async convertWithFfmpeg(
    audioBuffer: Buffer,
    fromFormat: string,
    toFormat: string,
  ): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `input_${Date.now()}.${fromFormat}`);
    const outputFile = path.join(tempDir, `output_${Date.now()}.${toFormat}`);

    try {
      // Write input file
      fs.writeFileSync(inputFile, audioBuffer);

      // Convert using ffmpeg
      await execAsync(`${this.ffmpegPath} -i ${inputFile} -y ${outputFile}`);

      // Read output file
      const outputBuffer = fs.readFileSync(outputFile);

      return outputBuffer;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (error) {
        this.logger.warn('Failed to clean up temp files', error);
      }
    }
  }

  /**
   * Convert sample rate using ffmpeg
   */
  private async convertSampleRateWithFfmpeg(
    audioBuffer: Buffer,
    fromRate: number,
    toRate: number,
  ): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `input_${Date.now()}.wav`);
    const outputFile = path.join(tempDir, `output_${Date.now()}.wav`);

    try {
      // Write input file
      fs.writeFileSync(inputFile, audioBuffer);

      // Convert sample rate
      await execAsync(
        `${this.ffmpegPath} -i ${inputFile} -ar ${toRate} -y ${outputFile}`,
      );

      // Read output file
      const outputBuffer = fs.readFileSync(outputFile);

      return outputBuffer;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (error) {
        this.logger.warn('Failed to clean up temp files', error);
      }
    }
  }

  /**
   * Convert channels using ffmpeg
   */
  private async convertChannelsWithFfmpeg(
    audioBuffer: Buffer,
    fromChannels: number,
    toChannels: number,
  ): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `input_${Date.now()}.wav`);
    const outputFile = path.join(tempDir, `output_${Date.now()}.wav`);

    try {
      // Write input file
      fs.writeFileSync(inputFile, audioBuffer);

      // Convert channels
      const channelFilter =
        toChannels === 1 ? '-ac 1' : toChannels === 2 ? '-ac 2' : '';
      await execAsync(
        `${this.ffmpegPath} -i ${inputFile} ${channelFilter} -y ${outputFile}`,
      );

      // Read output file
      const outputBuffer = fs.readFileSync(outputFile);

      return outputBuffer;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (error) {
        this.logger.warn('Failed to clean up temp files', error);
      }
    }
  }

  /**
   * Basic conversion (fallback when ffmpeg not available)
   */
  private async convertBasic(
    audioBuffer: Buffer,
    fromFormat: string,
    toFormat: string,
  ): Promise<Buffer> {
    // Limited support - mainly for PCM to WAV
    if (
      fromFormat.toLowerCase() === 'pcm' &&
      toFormat.toLowerCase() === 'wav'
    ) {
      return this.pcmToWav(audioBuffer, 16000, 1, 16);
    }

    // For other conversions, return as-is
    this.logger.warn(
      `Format conversion from ${fromFormat} to ${toFormat} not supported without ffmpeg`,
    );
    return audioBuffer;
  }

  /**
   * Convert PCM to WAV
   */
  private pcmToWav(
    pcmBuffer: Buffer,
    sampleRate: number,
    channels: number,
    bitDepth: number,
  ): Buffer {
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const wavBuffer = Buffer.alloc(fileSize);

    // RIFF header
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(fileSize - 8, 4);
    wavBuffer.write('WAVE', 8);

    // fmt chunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16); // fmt chunk size
    wavBuffer.writeUInt16LE(1, 20); // audio format (PCM)
    wavBuffer.writeUInt16LE(channels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // byte rate
    wavBuffer.writeUInt16LE(channels * (bitDepth / 8), 32); // block align
    wavBuffer.writeUInt16LE(bitDepth, 34);

    // data chunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(wavBuffer, 44);

    return wavBuffer;
  }
}
