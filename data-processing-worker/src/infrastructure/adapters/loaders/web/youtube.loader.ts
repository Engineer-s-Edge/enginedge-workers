import { Injectable, Logger } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * YouTube Loader Adapter
 * Loads video metadata and transcripts from YouTube
 * Supports captions/subtitles extraction
 */
@Injectable()
export class YoutubeLoaderAdapter extends WebLoaderPort {
  private readonly logger = new Logger(YoutubeLoaderAdapter.name);
  readonly name = 'youtube';
  readonly supportedProtocols = ['https'];

  /**
   * Load content from YouTube video
   */
  async loadUrl(
    url: string,
    options?: {
      apiKey?: string;
      includeTranscript?: boolean;
      language?: string;
      includeMetadata?: boolean;
    },
  ): Promise<Document[]> {
    try {
      const videoId = this._extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL: could not extract video ID');
      }

      const documents: Document[] = [];

      // Load metadata if requested
      if (options?.includeMetadata !== false) {
        const metadata = await this._loadMetadata(videoId, options?.apiKey);
        if (metadata) {
          documents.push(metadata);
        }
      }

      // Load transcript if requested
      if (options?.includeTranscript !== false) {
        const transcript = await this._loadTranscript(
          videoId,
          options?.language || 'en',
        );
        if (transcript) {
          documents.push(transcript);
        }
      }

      return documents;
    } catch (error: any) {
      throw new Error(`Failed to load YouTube content: ${error.message}`);
    }
  }

  /**
   * Load video metadata using YouTube Data API
   */
  private async _loadMetadata(
    videoId: string,
    apiKey?: string,
  ): Promise<Document | null> {
    try {
      const key = apiKey || process.env.YOUTUBE_API_KEY;
      if (!key) {
        this.logger.warn('YouTube API key not provided. Skipping metadata.');
        return null;
      }

      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoId,
            key,
          },
        },
      );

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const item = response.data.items[0];
      const snippet = item.snippet;
      const statistics = item.statistics;
      const contentDetails = item.contentDetails;

      const content = `Title: ${snippet.title}\n\nDescription: ${snippet.description}`;

      const documentId = `youtube-${crypto.createHash('md5').update(`${videoId}-${Date.now()}`).digest('hex')}`;
      return new Document(documentId, content, {
        source: `https://www.youtube.com/watch?v=${videoId}`,
        sourceType: 'url',
        loader: this.name,
        type: 'metadata',
        videoId,
        title: snippet.title,
        description: snippet.description,
        channelTitle: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        duration: contentDetails.duration,
        viewCount: statistics.viewCount,
        likeCount: statistics.likeCount,
        commentCount: statistics.commentCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.warn(`Failed to load YouTube metadata: ${error.message}`);
      return null;
    }
  }

  /**
   * Load video transcript/captions
   *
   * PLACEHOLDER IMPLEMENTATION: YouTube Transcript Loading
   *
   * This is an intentional placeholder for transcript functionality.
   * A full implementation would integrate with youtube-transcript package or YouTube Data API
   * to extract captions/subtitles from videos. The placeholder returns null to allow
   * the system to function while transcript capabilities are developed.
   *
   * Future implementation should:
   * - Install youtube-transcript package: npm install youtube-transcript
   * - Use YoutubeTranscript.fetchTranscript() to get captions
   * - Support multiple languages via language parameter
   * - Handle cases where transcripts are not available
   * - Return Document with transcript content and metadata
   */
  private async _loadTranscript(
    videoId: string,
    language: string,
  ): Promise<Document | null> {
    try {
      this.logger.warn(
        'Transcript loading not fully implemented. Consider installing youtube-transcript package.',
      );

      /*
      // Example using youtube-transcript package:
      const { YoutubeTranscript } = require('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: language,
      });

      const content = transcript.map((item: any) => item.text).join(' ');

      return new Document({
        content,
        metadata: {
          source: `https://www.youtube.com/watch?v=${videoId}`,
          loader: this.name,
          type: 'transcript',
          videoId,
          language,
          timestamp: new Date().toISOString(),
        },
      });
      */

      return null;
    } catch (error: any) {
      this.logger.warn(`Failed to load YouTube transcript: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract video ID from YouTube URL
   */
  private _extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // youtube.com/watch?v=VIDEO_ID
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      }

      // youtu.be/VIDEO_ID
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('youtube.com') ||
        urlObj.hostname === 'youtu.be'
      );
    } catch {
      return false;
    }
  }

  supports(source: string | Blob): boolean {
    if (typeof source !== 'string') return false;
    try {
      const url = new URL(source);
      return (
        this.supportedProtocols?.includes(url.protocol.replace(':', '')) ??
        ['http', 'https'].includes(url.protocol.replace(':', ''))
      );
    } catch {
      return false;
    }
  }

  getSupportedTypes(): string[] {
    return this.supportedProtocols ?? ['http', 'https'];
  }
}
