/**
 * OCR Retriever - Infrastructure Layer
 *
 * Sends OCR requests to the OCR worker node via Kafka for text extraction from images.
 * Acts as a proxy to the dedicated OCR processing service.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';
import axios, { AxiosResponse } from 'axios';

export interface OCRArgs {
  operation: 'extract' | 'analyze';
  imagePath?: string;
  imageData?: string; // base64 encoded image
  language?: string;
  confidence?: number;
  [key: string]: unknown; // Index signature for compatibility
}

export interface OCROutput extends ToolOutput {
  success: boolean;
  operation: string;
  text?: string;
  confidence?: number;
  language?: string;
  boundingBoxes?: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  wordCount?: number;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class OCRRetriever extends BaseRetriever<OCRArgs, OCROutput> {
  readonly name = 'ocr-retriever';
  readonly description = 'Extract text from images using Optical Character Recognition via OCR worker';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  constructor() {
    const errorEvents = [
      new ErrorEvent('ocr-request-failed', 'Failed to send OCR request to worker node', false),
      new ErrorEvent('ocr-timeout', 'OCR request timed out waiting for response', true),
      new ErrorEvent('ocr-worker-unavailable', 'OCR worker node is not available', false),
      new ErrorEvent('ocr-processing-error', 'OCR worker reported processing error', false)
    ];

    const metadata = new RetrieverConfig(
      'ocr-retriever',
      'Extract text from images using Optical Character Recognition via OCR worker',
      'Send OCR requests to dedicated OCR worker node for text extraction from images with confidence scoring',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['extract', 'analyze'],
            description: 'The OCR operation to perform'
          },
          imagePath: {
            type: 'string',
            description: 'Path to the image file for OCR processing'
          },
          imageData: {
            type: 'string',
            description: 'Base64 encoded image data (alternative to imagePath)'
          },
          language: {
            type: 'string',
            description: 'Language code for OCR (default: eng)',
            default: 'eng',
            examples: ['eng', 'spa', 'fra', 'deu']
          },
          confidence: {
            type: 'number',
            description: 'Minimum confidence threshold (0-100)',
            default: 60,
            minimum: 0,
            maximum: 100
          }
        }
      },
      {
        type: 'object',
        required: ['success', 'operation'],
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          text: { type: 'string' },
          confidence: { type: 'number' },
          language: { type: 'string' },
          boundingBoxes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                confidence: { type: 'number' },
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' }
              }
            }
          },
          wordCount: { type: 'number' },
          processingTime: { type: 'number' },
          message: { type: 'string' }
        }
      },
      [
        {
          name: 'ocr-retriever',
          args: { operation: 'extract', imagePath: 'document.png' }
        },
        {
          name: 'ocr-retriever',
          args: { operation: 'analyze', imagePath: 'receipt.jpg', language: 'eng' }
        }
      ],
      RetrievalType.OCR,
      false, // no caching for external service calls
      {
        similarity: 0.0,
        topK: 100,
        includeMetadata: true
      }
    );

    super(metadata, errorEvents);

    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get retrievalType(): string {
    return 'ocr';
  }

  get caching(): boolean {
    return false; // Don't cache external service calls
  }

  protected async retrieve(args: OCRArgs & { ragConfig: RAGConfig }): Promise<OCROutput> {
    const { operation, imagePath, imageData, language = 'eng', confidence = 60 } = args;

    // Validate operation
    if (operation !== 'extract' && operation !== 'analyze') {
      throw Object.assign(new Error('Unknown operation'), {
        name: 'ValidationError'
      });
    }

    // Validate required parameters
    if (!imagePath && !imageData) {
      throw Object.assign(new Error('Either imagePath or imageData parameter is required'), {
        name: 'ValidationError'
      });
    }

    if (imagePath && imageData) {
      throw Object.assign(new Error('Cannot specify both imagePath and imageData'), {
        name: 'ValidationError'
      });
    }

    // Send request to OCR worker via Kafka
    return await this.sendOCRRequest({
      operation,
      imagePath,
      imageData,
      language,
      confidence
    });
  }

  private async sendOCRRequest(request: {
    operation: string;
    imagePath?: string;
    imageData?: string;
    language: string;
    confidence: number;
  }): Promise<OCROutput> {
    const startTime = Date.now();

    try {
      // Make HTTP call to data-processing-worker (port 3003 in K8s)
      const DATA_PROCESSING_URL = process.env.DATA_PROCESSING_WORKER_URL || 'http://data-processing-worker:3003';
      const response: AxiosResponse = await axios.post(`${DATA_PROCESSING_URL}/command/process`, {
        type: 'ocr',
        operation: request.operation,
        imagePath: request.imagePath,
        imageData: request.imageData,
        language: request.language,
        confidence: request.confidence
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const processingTime = Date.now() - startTime;

      if (response.data.success) {
        return {
          success: true,
          operation: request.operation,
          text: response.data.text,
          confidence: response.data.confidence,
          language: request.language,
          boundingBoxes: response.data.boundingBoxes,
          wordCount: response.data.wordCount,
          processingTime
        };
      } else {
        return {
          success: false,
          operation: request.operation,
          message: response.data.error || 'OCR processing failed',
          processingTime
        };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const axiosError = error as { code?: string; response?: { status?: number; data?: { error?: string } }; message?: string };

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw Object.assign(new Error('OCR service is not available'), {
          name: 'ServiceUnavailableError'
        });
      }

      if (axiosError.response?.status === 408 || axiosError.code === 'ETIMEDOUT') {
        throw Object.assign(new Error('OCR request timed out'), {
          name: 'TimeoutError'
        });
      }

      const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Unknown error';
      throw Object.assign(new Error(`OCR request failed: ${errorMessage}`), {
        name: 'OCRError'
      });
    }
  }

  private generateMockOCRResponse(request: {
    operation: string;
    imagePath?: string;
    imageData?: string;
    language: string;
    confidence: number;
  }): OCROutput {
    const mockText = `This is extracted text from the image.
It contains multiple lines and paragraphs.
The OCR confidence is approximately 85%.
Language: ${request.language}`;

    const words = mockText.split(/\s+/).length;

    if (request.operation === 'extract') {
      return {
        success: true,
        operation: 'extract',
        text: mockText,
        confidence: 85,
        language: request.language,
        wordCount: words
      };
    } else {
      // analyze operation
      const mockBoundingBoxes = [
        {
          text: 'This is extracted text',
          confidence: 92,
          x: 10,
          y: 20,
          width: 150,
          height: 15
        },
        {
          text: 'from the image',
          confidence: 88,
          x: 10,
          y: 40,
          width: 100,
          height: 15
        }
      ];

      return {
        success: true,
        operation: 'analyze',
        text: mockText,
        confidence: 90,
        language: request.language,
        boundingBoxes: mockBoundingBoxes,
        wordCount: words
      };
    }
  }
}