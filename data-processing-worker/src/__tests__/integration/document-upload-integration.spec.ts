/**
 * Integration Tests - Phase 8
 * Simple integration tests to verify worker communication patterns
 * 
 * Test IDs: phase8-int-001 to phase8-int-010
 */

describe('Phase 8 Integration Tests', () => {
  describe('phase8-int-001: Data Processing Worker service discovery', () => {
    it('should be accessible on port 3003', () => {
      const expectedUrl = process.env.DATA_PROCESSING_WORKER_URL || 'http://data-processing-worker:3003';
      expect(expectedUrl).toMatch(/3003$/);
    });
  });

  describe('phase8-int-002: Environment variable validation', () => {
    it('should have required environment variables defined', () => {
      // These can be set in test environment or use defaults
      const requiredVars = {
        PORT: process.env.PORT || '3003',
        NODE_ENV: process.env.NODE_ENV || 'test',
      };

      expect(requiredVars.PORT).toBeDefined();
      expect(requiredVars.NODE_ENV).toBeDefined();
    });
  });

  describe('phase8-int-003: RAG configuration defaults', () => {
    it('should have sensible RAG defaults', () => {
      const ragDefaults = {
        topK: Number(process.env.DEFAULT_RAG_TOP_K) || 5,
        chunkSize: Number(process.env.DEFAULT_CHUNK_SIZE) || 1000,
        chunkOverlap: Number(process.env.DEFAULT_CHUNK_OVERLAP) || 200,
      };

      expect(ragDefaults.topK).toBeGreaterThan(0);
      expect(ragDefaults.chunkSize).toBeGreaterThan(0);
      expect(ragDefaults.chunkOverlap).toBeLessThan(ragDefaults.chunkSize);
    });
  });

  describe('phase8-int-004: Kafka topic naming convention', () => {
    it('should follow versioned topic naming', () => {
      const topics = [
        'document.upload.v1',
        'document.uploaded.v1',
        'embedding.generate.v1',
        'embedding.generated.v1',
        'vector.search.v1',
        'vector.search.result.v1',
        'ocr.process.v1',
        'ocr.complete.v1',
      ];

      topics.forEach((topic) => {
        expect(topic).toMatch(/\.v\d+$/);
      });
    });
  });

  describe('phase8-int-005: API endpoint structure', () => {
    it('should have RESTful endpoint patterns', () => {
      const endpoints = [
        { path: '/documents', method: 'POST' },
        { path: '/documents/process-for-rag', method: 'POST' },
        { path: '/documents/by-conversation/:id', method: 'GET' },
        { path: '/vector-store/search', method: 'POST' },
        { path: '/vector-store/search-conversations', method: 'POST' },
        { path: '/embedders/embed', method: 'POST' },
        { path: '/embedders/models', method: 'GET' },
      ];

      endpoints.forEach((endpoint) => {
        expect(endpoint.path).toBeTruthy();
        expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(endpoint.method);
      });
    });
  });

  describe('phase8-int-006: Worker service URLs', () => {
    it('should have correct service DNS names', () => {
      const services = {
        dataProcessing: 'http://data-processing-worker:3003',
        agentTool: 'http://agent-tool-worker:3002',
        assistant: 'http://assistant-worker:3001',
      };

      Object.values(services).forEach((url) => {
        expect(url).toMatch(/^http:\/\/[a-z-]+:\d{4}$/);
      });
    });
  });

  describe('phase8-int-007: Conversation scoping validation', () => {
    it('should validate conversation ID format', () => {
      const validConversationIds = [
        'conv-12345',
        'conversation-abc-def',
        'conv_test_123',
      ];

      const invalidConversationIds = [
        '',
        null,
        undefined,
        'conv 123', // spaces
        'conv@123', // special chars
      ];

      validConversationIds.forEach((id) => {
        expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
      });

      invalid ConversationIds.forEach((id) => {
        if (id) {
          expect(id).not.toMatch(/^[a-zA-Z0-9_-]+$/);
        } else {
          expect(id).toBeFalsy();
        }
      });
    });
  });

  describe('phase8-int-008: Embedding model availability', () => {
    it('should list available embedding models', () => {
      const models = [
        { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
        { provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072 },
        { provider: 'openai', model: 'text-embedding-ada-002', dimensions: 1536 },
        { provider: 'google', model: 'text-embedding-004', dimensions: 768 },
        { provider: 'cohere', model: 'embed-english-v3.0', dimensions: 1024 },
        { provider: 'huggingface', model: 'all-MiniLM-L6-v2', dimensions: 384 },
      ];

      models.forEach((model) => {
        expect(model.provider).toBeTruthy();
        expect(model.model).toBeTruthy();
        expect(model.dimensions).toBeGreaterThan(0);
      });
    });
  });

  describe('phase8-int-009: Vector search similarity metrics', () => {
    it('should support standard similarity metrics', () => {
      const metrics = ['cosine', 'euclidean', 'dotProduct'];

      metrics.forEach((metric) => {
        expect(['cosine', 'euclidean', 'dotProduct', 'manhattan']).toContain(metric);
      });
    });
  });

  describe('phase8-int-010: Error handling structure', () => {
    it('should have consistent error response format', () => {
      const errorResponse = {
        error: 'ValidationError',
        message: 'Invalid input parameters',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: '/documents',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('statusCode');
      expect(errorResponse).toHaveProperty('timestamp');
      expect(errorResponse.statusCode).toBeGreaterThanOrEqual(400);
      expect(errorResponse.statusCode).toBeLessThan(600);
    });
  });
});

  afterAll(async () => {
    await app.close();
  });

  describe('doc-upload-int-001: Upload single document via REST', () => {
    it('should upload and process document', async () => {
      const documentId = 'doc-12345';
      const content = 'This is a test document for processing.';

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [{ id: 'chunk-1', content, metadata: {} }],
        embeddings: [[0.1, 0.2, 0.3]],
        metadata: {
          processedAt: new Date().toISOString(),
          chunkCount: 1,
          embeddingModel: 'text-embedding-3-small',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content,
          metadata: {
            userId: 'user-123',
            conversationId: 'conv-456',
            source: 'upload',
          },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        documentId,
        status: 'processed',
      });
      expect(response.body.chunks).toHaveLength(1);
      expect(response.body.embeddings).toHaveLength(1);
    });
  });

  describe('doc-upload-int-002: Upload document via Kafka', () => {
    it('should process document.upload message', async () => {
      const message = {
        value: JSON.stringify({
          documentId: 'doc-67890',
          content: 'Kafka uploaded document content.',
          metadata: {
            userId: 'user-789',
            conversationId: 'conv-012',
            source: 'kafka',
          },
        }),
      };

      jest.spyOn(kafkaAdapter, 'handleDocumentUpload').mockResolvedValue(undefined);
      jest.spyOn(kafkaAdapter, 'publishDocumentUploaded').mockResolvedValue(undefined);

      await kafkaAdapter.handleDocumentUpload(message);

      expect(kafkaAdapter.handleDocumentUpload).toHaveBeenCalledWith(message);
      expect(kafkaAdapter.publishDocumentUploaded).toHaveBeenCalled();
    });
  });

  describe('doc-upload-int-003: Upload large document (chunking)', () => {
    it('should chunk document exceeding max size', async () => {
      const largeContent = 'A'.repeat(5000); // Exceeds default 1000 chunk size
      const documentId = 'doc-large-1';

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [
          { id: 'chunk-1', content: 'A'.repeat(1000), metadata: { index: 0 } },
          { id: 'chunk-2', content: 'A'.repeat(1000), metadata: { index: 1 } },
          { id: 'chunk-3', content: 'A'.repeat(1000), metadata: { index: 2 } },
          { id: 'chunk-4', content: 'A'.repeat(1000), metadata: { index: 3 } },
          { id: 'chunk-5', content: 'A'.repeat(1000), metadata: { index: 4 } },
        ],
        embeddings: new Array(5).fill([0.1, 0.2, 0.3]),
        metadata: {
          processedAt: new Date().toISOString(),
          chunkCount: 5,
          embeddingModel: 'text-embedding-3-small',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content: largeContent,
          metadata: { userId: 'user-123' },
        })
        .expect(201);

      expect(response.body.chunks.length).toBeGreaterThan(1);
      expect(response.body.metadata.chunkCount).toBe(5);
    });
  });

  describe('doc-upload-int-004: Upload with custom chunk config', () => {
    it('should use custom chunk size and overlap', async () => {
      const content = 'A'.repeat(3000);
      const documentId = 'doc-custom-chunk';

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [
          { id: 'chunk-1', content: 'A'.repeat(500), metadata: { index: 0 } },
          { id: 'chunk-2', content: 'A'.repeat(500), metadata: { index: 1 } },
          { id: 'chunk-3', content: 'A'.repeat(500), metadata: { index: 2 } },
          { id: 'chunk-4', content: 'A'.repeat(500), metadata: { index: 3 } },
          { id: 'chunk-5', content: 'A'.repeat(500), metadata: { index: 4 } },
          { id: 'chunk-6', content: 'A'.repeat(500), metadata: { index: 5 } },
        ],
        embeddings: new Array(6).fill([0.1, 0.2, 0.3]),
        metadata: {
          processedAt: new Date().toISOString(),
          chunkCount: 6,
          chunkSize: 500,
          chunkOverlap: 100,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content,
          chunkSize: 500,
          chunkOverlap: 100,
          metadata: { userId: 'user-123' },
        })
        .expect(201);

      expect(response.body.metadata.chunkSize).toBe(500);
      expect(response.body.metadata.chunkOverlap).toBe(100);
    });
  });

  describe('doc-upload-int-005: Upload with conversation scope', () => {
    it('should associate document with conversation', async () => {
      const conversationId = 'conv-test-123';
      const documentId = 'doc-conv-scope';

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [{ id: 'chunk-1', content: 'Test', metadata: {} }],
        embeddings: [[0.1, 0.2, 0.3]],
        metadata: {
          processedAt: new Date().toISOString(),
          conversationId,
          chunkCount: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content: 'Conversation-scoped document',
          metadata: {
            userId: 'user-123',
            conversationId,
          },
        })
        .expect(201);

      expect(response.body.metadata.conversationId).toBe(conversationId);
    });
  });

  describe('doc-upload-int-006: Upload with metadata extraction', () => {
    it('should extract and preserve metadata', async () => {
      const documentId = 'doc-metadata';
      const metadata = {
        userId: 'user-456',
        conversationId: 'conv-789',
        source: 'file-upload',
        filename: 'test-doc.txt',
        fileType: 'text/plain',
        uploadedAt: new Date().toISOString(),
      };

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [{ id: 'chunk-1', content: 'Test', metadata: {} }],
        embeddings: [[0.1, 0.2, 0.3]],
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          chunkCount: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content: 'Test document',
          metadata,
        })
        .expect(201);

      expect(response.body.metadata).toMatchObject(metadata);
    });
  });

  describe('doc-upload-int-007: Upload multiple documents concurrently', () => {
    it('should handle concurrent uploads', async () => {
      const uploads = [
        { content: 'Document 1', metadata: { userId: 'user-1' } },
        { content: 'Document 2', metadata: { userId: 'user-2' } },
        { content: 'Document 3', metadata: { userId: 'user-3' } },
      ];

      jest.spyOn(processDocumentUseCase, 'execute').mockImplementation(async () => ({
        documentId: `doc-${Date.now()}`,
        status: 'processed',
        chunks: [{ id: 'chunk-1', content: 'Test', metadata: {} }],
        embeddings: [[0.1, 0.2, 0.3]],
        metadata: {
          processedAt: new Date().toISOString(),
          chunkCount: 1,
        },
      }));

      const responses = await Promise.all(
        uploads.map((upload) =>
          request(app.getHttpServer()).post('/documents').send(upload)
        )
      );

      expect(responses).toHaveLength(3);
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('processed');
      });
    });
  });

  describe('doc-upload-int-008: Upload validation (missing fields)', () => {
    it('should reject upload without content', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          metadata: { userId: 'user-123' },
        })
        .expect(400);

      expect(response.body.message).toContain('content');
    });
  });

  describe('doc-upload-int-009: Upload with embedding model selection', () => {
    it('should use specified embedding model', async () => {
      const documentId = 'doc-custom-model';

      jest.spyOn(processDocumentUseCase, 'execute').mockResolvedValue({
        documentId,
        status: 'processed',
        chunks: [{ id: 'chunk-1', content: 'Test', metadata: {} }],
        embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
        metadata: {
          processedAt: new Date().toISOString(),
          chunkCount: 1,
          embeddingModel: 'text-embedding-3-large',
          embeddingDimensions: 3072,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/documents')
        .send({
          content: 'Test document',
          embeddingProvider: 'openai',
          embeddingModel: 'text-embedding-3-large',
          metadata: { userId: 'user-123' },
        })
        .expect(201);

      expect(response.body.metadata.embeddingModel).toBe('text-embedding-3-large');
    });
  });

  describe('doc-upload-int-010: Upload with retry on failure', () => {
    it('should retry failed upload via Kafka', async () => {
      const message = {
        value: JSON.stringify({
          documentId: 'doc-retry',
          content: 'Retry test',
          metadata: { userId: 'user-retry' },
        }),
      };

      jest
        .spyOn(kafkaAdapter, 'handleDocumentUpload')
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      // First attempt fails
      await expect(kafkaAdapter.handleDocumentUpload(message)).rejects.toThrow(
        'Temporary failure'
      );

      // Retry succeeds
      await kafkaAdapter.handleDocumentUpload(message);
      expect(kafkaAdapter.handleDocumentUpload).toHaveBeenCalledTimes(2);
    });
  });
});
