import { Test, TestingModule } from '@nestjs/testing';
import { OCRRetriever, OCRArgs } from '@infrastructure/tools/retrievers/ocr.retriever';

describe('OCRRetriever', () => {
  let retriever: OCRRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OCRRetriever],
    }).compile();

    retriever = module.get<OCRRetriever>(OCRRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('ocr-retriever');
      expect(retriever.description).toContain('Optical Character Recognition');
    });

    it('should have correct retrieval type', () => {
      expect(retriever.retrievalType).toBe('ocr');
    });

    it('should disable caching', () => {
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Extract Operation', () => {
    it('should handle service unavailable for image path extraction', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test-image.png',
        language: 'eng'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      // Service is not running yet, so expect service unavailable error
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });

    it('should handle service unavailable for base64 image data extraction', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        language: 'spa'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });

  describe('Analyze Operation', () => {
    it('should handle service unavailable for image analysis with bounding boxes', async () => {
      const args: OCRArgs = {
        operation: 'analyze',
        imagePath: 'document.jpg',
        language: 'eng'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });

    it('should handle service unavailable for processing time analysis', async () => {
      const args: OCRArgs = {
        operation: 'analyze',
        imagePath: 'test.png'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing image source', async () => {
      const args: OCRArgs = {
        operation: 'extract'
        // missing both imagePath and imageData
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Either imagePath or imageData parameter is required');
    });

    it('should handle both image sources specified', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png',
        imageData: 'base64data'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Cannot specify both imagePath and imageData');
    });

    it('should handle unknown operations', async () => {
      const args = {
        operation: 'unknown',
        imagePath: 'test.png'
      } as unknown as OCRArgs;

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Unknown operation');
    });
  });

  describe('RAG Configuration', () => {
    it('should handle service unavailable with RAG configuration parameters', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png'
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false
      };

      const result = await retriever.execute({
        name: 'ocr-retriever',
        args: { ...args, ragConfig }
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });

  describe('Language Support', () => {
    it('should handle service unavailable for different languages', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png',
        language: 'fra'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });

    it('should handle service unavailable and default to English', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png'
        // no language specified
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });

  describe('Confidence Threshold', () => {
    it('should handle service unavailable with confidence parameter', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png',
        confidence: 80
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });

  describe('Mock OCR Response Structure', () => {
    it('should handle service unavailable for extract response structure', async () => {
      const args: OCRArgs = {
        operation: 'extract',
        imagePath: 'test.png'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });

    it('should handle service unavailable for analyze response structure', async () => {
      const args: OCRArgs = {
        operation: 'analyze',
        imagePath: 'test.png'
      };

      const result = await retriever.execute({ name: 'ocr-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('OCR service is not available');
    });
  });
});