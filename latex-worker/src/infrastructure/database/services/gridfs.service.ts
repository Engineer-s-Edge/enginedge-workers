/**
 * GridFS Service for PDF Storage
 * 
 * Handles large file storage using MongoDB GridFS
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { IPDFStorage } from '../../../domain/ports';

@Injectable()
export class GridFSService implements IPDFStorage, OnModuleInit {
  private gridFSBucket!: GridFSBucket;

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  onModuleInit() {
    if (!this.connection.db) {
      throw new Error('MongoDB connection not established');
    }
    this.gridFSBucket = new GridFSBucket(this.connection.db, {
      bucketName: 'pdfs',
    });
  }

  /**
   * Store a PDF file in GridFS
   */
  async store(filename: string, buffer: Buffer, metadata?: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(buffer);
      const uploadStream = this.gridFSBucket.openUploadStream(filename, {
        metadata: {
          ...metadata,
          contentType: 'application/pdf',
          uploadedAt: new Date(),
        },
      });

      readableStream.pipe(uploadStream);

      uploadStream.on('finish', () => {
        resolve(uploadStream.id.toString());
      });

      uploadStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Retrieve a PDF file from GridFS
   */
  async retrieve(id: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const downloadStream = this.gridFSBucket.openDownloadStream(
        new ObjectId(id),
      );

      downloadStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      downloadStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      downloadStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Delete a PDF file from GridFS
   */
  async delete(id: string): Promise<void> {
    await this.gridFSBucket.delete(new ObjectId(id));
  }

  /**
   * Check if a PDF file exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const files = await this.gridFSBucket
        .find({ _id: new ObjectId(id) })
        .toArray();
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get URL for a PDF file (not applicable for GridFS - returns null)
   * In production, you might serve these through an API endpoint
   */
  async getUrl(id: string): Promise<string | null> {
    // GridFS doesn't provide direct URLs
    // You would create an API endpoint to serve these files
    return null;
  }

  /**
   * Get file metadata
   */
  async getMetadata(id: string): Promise<any> {
    const files = await this.gridFSBucket
      .find({ _id: new ObjectId(id) })
      .toArray();

    if (files.length === 0) {
      throw new Error(`File with ID ${id} not found`);
    }

    return files[0].metadata;
  }

  /**
   * List all PDF files (with pagination)
   */
  async list(skip = 0, limit = 50): Promise<any[]> {
    return await this.gridFSBucket
      .find()
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Delete old PDF files
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const files = await this.gridFSBucket
      .find({
        'metadata.uploadedAt': { $lt: date },
      })
      .toArray();

    for (const file of files) {
      await this.gridFSBucket.delete(file._id);
    }

    return files.length;
  }
}
