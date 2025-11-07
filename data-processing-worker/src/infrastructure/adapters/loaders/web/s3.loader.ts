import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';

/**
 * S3 Web Loader Adapter
 * Loads files from AWS S3 buckets
 * Supports public and authenticated access
 *
 * Note: Requires AWS SDK v3
 * Install with: npm install @aws-sdk/client-s3
 */
@Injectable()
export class S3LoaderAdapter extends WebLoaderPort {
  readonly name = 's3';
  readonly supportedProtocols = ['s3', 'https'];
  private readonly logger = new Logger(S3LoaderAdapter.name);

  constructor(private readonly configService?: ConfigService) {
    super();
  }

  /**
   * Load content from S3
   */
  async loadUrl(
    url: string,
    options?: {
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
      recursive?: boolean;
    },
  ): Promise<Document[]> {
    try {
      // Try to use AWS SDK if available
      let S3Client: any;
      let GetObjectCommand: any;
      let ListObjectsV2Command: any;

      try {
        const s3Module = require('@aws-sdk/client-s3');
        S3Client = s3Module.S3Client;
        GetObjectCommand = s3Module.GetObjectCommand;
        ListObjectsV2Command = s3Module.ListObjectsV2Command;
      } catch (requireError) {
        this.logger.warn(
          '@aws-sdk/client-s3 not available, using HTTP fallback for public S3 objects',
        );
        return this.loadViaHttp(url, options);
      }

      const { bucket, key, isDirectory } = this._parseS3Url(url);

      const region =
        options?.region ||
        this.configService?.get<string>('AWS_REGION') ||
        'us-east-1';

      const accessKeyId =
        options?.accessKeyId ||
        this.configService?.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey =
        options?.secretAccessKey ||
        this.configService?.get<string>('AWS_SECRET_ACCESS_KEY');

      const s3Client = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? {
                accessKeyId,
                secretAccessKey,
              }
            : undefined,
      });

      const documents: Document[] = [];

      if (isDirectory || options?.recursive) {
        // List and load multiple objects
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: key,
        });

        const listResponse = await s3Client.send(listCommand);
        const contents = listResponse.Contents || [];

        for (const item of contents) {
          if (!item.Key) continue;

          const doc = await this._loadS3Object(s3Client, bucket, item.Key);
          if (doc) documents.push(doc);
        }
      } else {
        // Load single object
        const doc = await this._loadS3Object(s3Client, bucket, key);
        if (doc) documents.push(doc);
      }

      return documents;
    } catch (error: any) {
      this.logger.error(`Failed to load from S3: ${error.message}`);
      // Fallback to HTTP if SDK fails
      try {
        return this.loadViaHttp(url, options);
      } catch (httpError: any) {
        throw new Error(
          `Failed to load from S3: ${error.message}. HTTP fallback also failed: ${httpError.message}`,
        );
      }
    }
  }

  /**
   * Fallback: Load public S3 objects via HTTP
   */
  private async loadViaHttp(
    url: string,
    options?: {
      region?: string;
    },
  ): Promise<Document[]> {
    const { bucket, key } = this._parseS3Url(url);
    const region = options?.region || 'us-east-1';

    // Construct public S3 URL
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    this.logger.log(`Loading S3 object via HTTP: ${publicUrl}`);

    const response = await fetch(publicUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch S3 object via HTTP: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    return [
      new Document(
        `s3-${bucket}-${key}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        content,
        {
          source: url,
          loader: this.name,
          bucket,
          key,
          contentType: response.headers.get('content-type') || undefined,
          size: response.headers.get('content-length')
            ? parseInt(response.headers.get('content-length')!, 10)
            : undefined,
          timestamp: new Date().toISOString(),
        },
      ),
    ];
  }

  /**
   * Load a single S3 object
   */
  private async _loadS3Object(
    s3Client: any,
    bucket: string,
    key: string,
  ): Promise<Document | null> {
    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3Client.send(command);
      const stream = response.Body;

      // Read stream to string
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString('utf-8');

      return new Document(
        `s3-${bucket}-${key}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        content,
        {
          source: `s3://${bucket}/${key}`,
          loader: this.name,
          bucket,
          key,
          contentType: response.ContentType,
          size: response.ContentLength,
          lastModified: response.LastModified?.toISOString(),
          etag: response.ETag,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error: any) {
      this.logger.warn(`Failed to load S3 object ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse S3 URL
   */
  private _parseS3Url(url: string): {
    bucket: string;
    key: string;
    isDirectory: boolean;
  } {
    if (url.startsWith('s3://')) {
      // s3://bucket/key format
      const parts = url.replace('s3://', '').split('/');
      const bucket = parts[0];
      const key = parts.slice(1).join('/');
      return {
        bucket,
        key,
        isDirectory: key.endsWith('/') || !key,
      };
    } else {
      // https://bucket.s3.region.amazonaws.com/key format
      const urlObj = new URL(url);
      const bucket = urlObj.hostname.split('.')[0];
      const key = urlObj.pathname.slice(1); // Remove leading /
      return {
        bucket,
        key,
        isDirectory: key.endsWith('/'),
      };
    }
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      if (url.startsWith('s3://')) {
        return true;
      }
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('s3') &&
        urlObj.hostname.includes('amazonaws.com')
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
