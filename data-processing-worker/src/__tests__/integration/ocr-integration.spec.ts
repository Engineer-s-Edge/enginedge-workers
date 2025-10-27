import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CommandController } from '@infrastructure/controllers/command.controller';
import { CommandApplicationService } from '@application/services/command-application.service';
import { ProcessCommandUseCase } from '@application/use-cases/process-command.use-case';
import { CommandProcessorAdapter } from '@infrastructure/adapters/command-processor.adapter';

describe('OCR Integration Tests (ocr-int-001 to ocr-int-015)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommandController],
      providers: [
        CommandApplicationService,
        {
          provide: ProcessCommandUseCase,
          useValue: {
            execute: jest.fn().mockImplementation(async (command) => {
              const adapter = new CommandProcessorAdapter();
              return adapter.processCommand(command);
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('OCR Command Processing', () => {
    it('ocr-int-001: should process OCR command with image path', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-001',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imagePath: '/path/to/image.png',
            language: 'eng',
            confidence: 0.8,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('taskId', 'ocr-test-001');
      expect(response.body).toHaveProperty('status', 'SUCCESS');
      expect(response.body.result).toHaveProperty('text');
      expect(response.body.result).toHaveProperty('confidence');
      expect(response.body.result.operation).toBe('extract');
    });

    it('ocr-int-002: should process OCR command with image data', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-002',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imageData: 'base64encodedimagedata',
            language: 'eng',
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.result.text).toContain('OCR placeholder');
    });

    it('ocr-int-003: should handle multi-language OCR', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-003',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imagePath: '/path/to/chinese.png',
            language: 'chi_sim+eng',
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.result.language).toBe('chi_sim+eng');
    });

    it('ocr-int-004: should handle OCR with confidence threshold', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-004',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imagePath: '/path/to/image.png',
            confidence: 0.95,
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('ocr-int-005: should handle OCR search operation', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-005',
          taskType: 'ocr',
          payload: {
            operation: 'search',
            imagePath: '/path/to/image.png',
            searchTerm: 'invoice',
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.result.operation).toBe('search');
    });

    it('ocr-int-006: should handle missing payload gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-006',
          taskType: 'ocr',
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.result).toHaveProperty('text');
      expect(response.body.result.language).toBe('eng'); // default
    });

    it('ocr-int-007: should use default confidence when not provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-007',
          taskType: 'ocr',
          payload: {
            imagePath: '/path/to/image.png',
          },
        })
        .expect(201);

      expect(response.body.result.confidence).toBe(0.95);
    });

    it('ocr-int-008: should handle batch OCR processing', async () => {
      const batchPayload = {
        taskId: 'ocr-test-008',
        taskType: 'ocr',
        payload: {
          operation: 'batch',
          images: [
            { path: '/path/to/image1.png' },
            { path: '/path/to/image2.png' },
          ],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send(batchPayload)
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
    });

    it('ocr-int-009: should handle OCR with bounding boxes', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-009',
          taskType: 'ocr',
          payload: {
            operation: 'extract_with_boxes',
            imagePath: '/path/to/image.png',
            returnBoundingBoxes: true,
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
    });

    it('ocr-int-010: should handle PDF OCR', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-010',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imagePath: '/path/to/document.pdf',
            language: 'eng',
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
    });

    it('ocr-int-011: should handle OCR with preprocessing', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-011',
          taskType: 'ocr',
          payload: {
            operation: 'extract',
            imagePath: '/path/to/noisy-image.png',
            preprocess: true,
            denoise: true,
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
    });

    it('ocr-int-012: should validate OCR response structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-012',
          taskType: 'ocr',
          payload: {
            imagePath: '/path/to/image.png',
          },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        taskId: 'ocr-test-012',
        status: 'SUCCESS',
        result: expect.objectContaining({
          text: expect.any(String),
          confidence: expect.any(Number),
          operation: expect.any(String),
          language: expect.any(String),
        }),
      });
    });

    it('ocr-int-013: should handle concurrent OCR requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/command/process')
          .send({
            taskId: `ocr-test-013-${i}`,
            taskType: 'ocr',
            payload: {
              imagePath: `/path/to/image${i}.png`,
            },
          }),
      );

      const responses = await Promise.all(requests);
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('SUCCESS');
      });
    });

    it('ocr-int-014: should handle OCR with metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-014',
          taskType: 'ocr',
          payload: {
            imagePath: '/path/to/image.png',
            metadata: {
              source: 'scanner',
              userId: 'user123',
              timestamp: new Date().toISOString(),
            },
          },
        })
        .expect(201);

      expect(response.body.status).toBe('SUCCESS');
    });

    it('ocr-int-015: should handle invalid task type gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/command/process')
        .send({
          taskId: 'ocr-test-015',
          taskType: 'invalid_type',
          payload: {},
        })
        .expect(201);

      expect(response.body.status).toBe('FAILURE');
      expect(response.body.error).toContain('Unknown task type');
    });
  });
});
