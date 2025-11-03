import { Injectable, Logger } from '@nestjs/common';
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

    // TODO: Integrate with OpenAI Whisper API
    this.logger.warn(
      'Whisper integration not yet implemented - returning empty document',
    );

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
        '[Audio transcription pending - Whisper integration required]',
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
