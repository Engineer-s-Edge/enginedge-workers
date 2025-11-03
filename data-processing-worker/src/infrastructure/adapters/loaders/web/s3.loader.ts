import { Injectable } from '@nestjs/common';
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
      // Placeholder implementation
      // TODO: Implement when @aws-sdk/client-s3 is added to dependencies
      /*
      const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

      const { bucket, key, isDirectory } = this._parseS3Url(url);

      const s3Client = new S3Client({
        region: options?.region || 'us-east-1',
        credentials: options?.accessKeyId && options?.secretAccessKey
          ? {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
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
      */

      throw new Error(
        'S3 loader not yet implemented. Please install @aws-sdk/client-s3 package and uncomment implementation.',
      );
    } catch (error: any) {
      throw new Error(`Failed to load from S3: ${error.message}`);
    }
  }

  /**
   * Load a single S3 object
   */
  /*
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

      return new Document({
        content,
        metadata: {
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
      });
    } catch (error: any) {
      console.warn(`Failed to load S3 object ${key}: ${error.message}`);
      return null;
    }
  }
  */

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
