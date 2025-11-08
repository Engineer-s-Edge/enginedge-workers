import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesystemLoaderPort } from '../../../../domain/ports/loader.port';
import {
  Document,
  DocumentMetadata,
} from '../../../../domain/entities/document.entity';
import * as crypto from 'crypto';

/**
 * OpenAI Whisper Audio Loader
 * This would integrate with OpenAI's Whisper API for speech-to-text
 * Currently a placeholder - would need OpenAI API integration
 */
@Injectable()
export class WhisperAudioLoaderAdapter extends FilesystemLoaderPort {
  private readonly logger = new Logger(WhisperAudioLoaderAdapter.name);

  constructor(private readonly configService?: ConfigService) {
    super();
  }

  async load(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'audio.mp3';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('Whisper loader only supports Blob input.');
  }

  async loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    this.logger.log(
      `Loading audio blob for Whisper transcription: ${fileName}`,
    );

    try {
      // Convert Blob to Buffer for OpenAI API
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Get OpenAI API key
      const openaiApiKey =
        this.configService?.get<string>('OPENAI_API_KEY') ||
        process.env.OPENAI_API_KEY;

      if (!openaiApiKey) {
        this.logger.warn(
          'OpenAI API key not configured, falling back to placeholder',
        );
        return this.getPlaceholderDocument(fileName, blob, options);
      }

      // Call OpenAI Whisper API
      const formData = new FormData();
      const fileBlob = new Blob([buffer], { type: blob.type });
      formData.append('file', fileBlob, fileName);
      formData.append('model', 'whisper-1');
      if (options?.language) {
        formData.append('language', options.language as string);
      }
      if (options?.prompt) {
        formData.append('prompt', options.prompt as string);
      }
      if (options?.responseFormat) {
        formData.append('response_format', options.responseFormat as string);
      }
      if (options?.temperature !== undefined) {
        formData.append('temperature', String(options.temperature));
      }

      const response = await fetch(
        'https://api.openai.com/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI Whisper API error: ${response.status} - ${errorText}`,
        );
        return this.getPlaceholderDocument(fileName, blob, options);
      }

      const result = await response.json();
      const transcription = result.text || result.transcription || '';

      const metadata: DocumentMetadata = {
        source: fileName,
        sourceType: 'file',
        mimeType: blob.type,
        fileName,
        fileExtension: this.getExtension(fileName),
        transcriptionModel: 'whisper-1',
        transcriptionLanguage: result.language,
        ...(options?.metadata as Record<string, unknown>),
      };

      return [
        new Document(
          this.generateDocumentId(fileName, 0),
          transcription,
          metadata,
        ),
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to transcribe audio with Whisper: ${message}`);
      return this.getPlaceholderDocument(fileName, blob, options);
    }
  }

  private getPlaceholderDocument(
    fileName: string,
    blob: Blob,
    options?: Record<string, unknown>,
  ): Document[] {
    const metadata: DocumentMetadata = {
      source: fileName,
      sourceType: 'file',
      mimeType: blob.type,
      fileName,
      fileExtension: this.getExtension(fileName),
      ...(options?.metadata as Record<string, unknown>),
    };

    return [
      new Document(
        this.generateDocumentId(fileName, 0),
        '[Audio transcription failed - check OpenAI API key configuration]',
        metadata,
      ),
    ];
  }

  supports(source: string | Blob): boolean {
    if (source instanceof Blob) {
      return (
        source.type.startsWith('audio/') || source.type.startsWith('video/')
      );
    }
    const ext = source.toLowerCase();
    return (
      ext.endsWith('.mp3') ||
      ext.endsWith('.wav') ||
      ext.endsWith('.m4a') ||
      ext.endsWith('.mp4')
    );
  }

  getSupportedTypes(): string[] {
    return ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.webm'];
  }

  private getExtension(fileName: string): string {
    const match = fileName.match(/\.([^.]+)$/);
    return match ? `.${match[1]}` : '';
  }

  private generateDocumentId(fileName: string, index: number): string {
    return `whisper-${crypto.createHash('md5').update(`${fileName}-${index}-${Date.now()}`).digest('hex')}`;
  }
}
