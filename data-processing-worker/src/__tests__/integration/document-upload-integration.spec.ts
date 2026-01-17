import { Test, TestingModule } from '@nestjs/testing';
import { KafkaDataProcessingAdapter } from '@infrastructure/adapters/messaging/kafka-data-processing.adapter';
import { DocumentProcessingService } from '@application/services/document-processing.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { VectorStorePort } from '@domain/ports/processing.port';

// Mock KafkaJS
const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

const mockConsumer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
  on: jest.fn(),
};

const mockKafka = {
  producer: jest.fn(() => mockProducer),
  consumer: jest.fn(() => mockConsumer),
};

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn(() => mockKafka),
    Partitioners: { LegacyPartitioner: jest.fn() },
  };
});

describe('Document Upload Integration Tests', () => {
  let kafkaAdapter: KafkaDataProcessingAdapter;
  let documentProcessingService: DocumentProcessingService;

  const mockVectorStore: VectorStorePort = {
    storeDocuments: jest.fn(),
    similaritySearch: jest.fn(),
    deleteDocuments: jest.fn(),
    getDocument: jest.fn(),
    // @ts-ignore - Some implementations might have it but not the interface
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaDataProcessingAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'KAFKA_BROKERS') return 'localhost:9092';
              return defaultValue;
            }),
          },
        },
        {
          provide: DocumentProcessingService,
          useValue: {
            processDocument: jest.fn(),
            deleteDocuments: jest.fn(),
          },
        },
        {
          provide: 'EmbedderPort',
          useValue: {
            embedDocuments: jest.fn(),
            embedQuery: jest.fn(),
          },
        },
        {
          provide: 'VectorStorePort',
          useValue: mockVectorStore,
        },
      ],
    }).compile();

    kafkaAdapter = module.get<KafkaDataProcessingAdapter>(
      KafkaDataProcessingAdapter,
    );
    documentProcessingService = module.get<DocumentProcessingService>(
      DocumentProcessingService,
    );

    // Initialize module to trigger Kafka connection
    await kafkaAdapter.onModuleInit();
  });

  afterEach(async () => {
    await kafkaAdapter.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('doc-upload-int-001: Initialization', () => {
    it('should initialize Kafka connection', () => {
      expect(mockKafka.producer).toHaveBeenCalled();
      expect(mockKafka.consumer).toHaveBeenCalled();
      expect(mockProducer.connect).toHaveBeenCalled();
      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'document.upload' }),
      );
    });
  });

  describe('doc-upload-int-002: Upload document via Kafka', () => {
    it('should result in processDocument call when receiving valid upload message', async () => {
      const payload = {
        taskId: 'task-upload-002',
        url: 'http://example.com/doc.pdf',
        metadata: {
          userId: 'user-789',
          source: 'kafka',
        },
      };

      const message = {
        topic: 'document.upload',
        partition: 0,
        message: {
          value: JSON.stringify(payload),
        },
      } as any;

      // Mock the service processing
      jest
        .spyOn(documentProcessingService, 'processDocument')
        .mockResolvedValue({
          documentIds: ['doc-1'],
          chunks: 5,
          // metadata removed as it's not in the return type
        });

      // Call the PRIVATE handleMessage method via generic casting
      await (kafkaAdapter as any).handleMessage(message);

      expect(documentProcessingService.processDocument).toHaveBeenCalledWith(
        payload.url,
        expect.objectContaining({
          split: true,
          embed: true,
          metadata: payload.metadata,
        }),
      );

      // Verify the success event publication
      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'document.uploaded',
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringContaining('"status":"SUCCESS"'),
            }),
          ]),
        }),
      );
    });
  });

  describe('doc-upload-int-003: Handling errors', () => {
    it('should handle missing source gracefully', async () => {
      const payload = {
        taskId: 'task-upload-003',
        // Missing url and content
        metadata: {},
      };

      const message = {
        topic: 'document.upload',
        partition: 0,
        message: {
          value: JSON.stringify(payload),
        },
      } as any;

      // Call handleMessage
      await (kafkaAdapter as any).handleMessage(message);

      // Should verify that it published a FAILURE message
      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'document.uploaded',
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringContaining('"status":"FAILURE"'),
            }),
          ]),
        }),
      );
    });

    it('should handle processing errors', async () => {
      const payload = {
        taskId: 'task-upload-err',
        content: 'some content',
      };

      jest
        .spyOn(documentProcessingService, 'processDocument')
        .mockRejectedValue(new Error('Processing failed'));

      const message = {
        topic: 'document.upload',
        partition: 0,
        message: {
          value: JSON.stringify(payload),
        },
      } as any;

      await (kafkaAdapter as any).handleMessage(message);

      expect(mockProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'document.uploaded',
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringMatching(
                /"status":"FAILURE".*Processing failed/,
              ),
            }),
          ]),
        }),
      );
    });
  });
});
