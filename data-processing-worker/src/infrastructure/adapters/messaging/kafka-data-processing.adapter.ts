import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Kafka,
  Consumer,
  Producer,
  EachMessagePayload,
  Partitioners,
} from 'kafkajs';
import { DocumentProcessingService } from '../../../application/services/document-processing.service';
import {
  EmbedderPort,
  VectorStorePort,
} from '../../../domain/ports/processing.port';

/**
 * Kafka Message Broker Adapter for Data Processing Worker
 *
 * Listens to document processing requests and publishes results.
 */
@Injectable()
export class KafkaDataProcessingAdapter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaDataProcessingAdapter.name);
  private kafka!: Kafka;
  private consumer!: Consumer;
  private producer!: Producer;
  private connected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentProcessingService: DocumentProcessingService,
    @Optional()
    @Inject('EmbedderPort')
    private readonly embedder?: EmbedderPort,
    @Optional()
    @Inject('VectorStorePort')
    private readonly vectorStore?: VectorStorePort,
  ) {
    this.initializeKafka();
  }

  private initializeKafka(): void {
    const brokers = this.configService.get<string>(
      'KAFKA_BROKERS',
      'localhost:9092',
    );

    // Suppress KafkaJS verbose logging to reduce spam when Kafka is unavailable
    const kafkaLogLevel =
      this.configService.get<string>('KAFKA_LOG_LEVEL') || 'NOTHING';
    const logCreator = () => {
      return () => {
        // No-op: suppress all KafkaJS logs by default
      };
    };

    const logLevelMap: Record<string, number> = {
      NOTHING: 0,
      ERROR: 4,
      WARN: 5,
      INFO: 6,
      DEBUG: 7,
    };

    this.kafka = new Kafka({
      clientId: 'data-processing-worker',
      brokers: brokers.split(',').map((broker) => broker.trim()),
      retry: { initialRetryTime: 300, retries: 3 },
      logLevel: logLevelMap[kafkaLogLevel] ?? 0,
      logCreator: kafkaLogLevel === 'NOTHING' ? logCreator : undefined,
    });

    this.consumer = this.kafka.consumer({
      groupId: 'data-processing-worker-group',
    });
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner, // Added to silence warning
      allowAutoTopicCreation: true,
      maxInFlightRequests: 1,
      idempotent: true,
    });

    this.logger.log(`Kafka initialized with brokers: ${brokers}`);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      if (this.connected) {
        await this.subscribe();
      } else {
        // Schedule retry if initial connection failed
        setTimeout(() => this.onModuleInit(), 5000);
      }
    } catch (error) {
      // Silently handle initialization errors
      // Schedule retry
      setTimeout(() => this.onModuleInit(), 5000);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.logger.log('Connecting to Kafka...');

      await this.consumer.connect();
      await this.producer.connect();

      this.connected = true;
      this.logger.log('Successfully connected to Kafka');
    } catch (error) {
      // Silently handle connection errors to prevent log spam
      // KafkaJS will automatically retry based on configuration
      this.connected = false;
      // Don't throw - let the service continue without Kafka
      // The subscribe method will handle retries
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connected) {
      this.logger.log('Disconnecting from Kafka...');

      await this.consumer.disconnect();
      await this.producer.disconnect();

      this.connected = false;
      this.logger.log('Disconnected from Kafka');
    }
  }

  private async subscribe(): Promise<void> {
    const topics = [
      'document.process',
      'document.search',
      'document.delete',
      'document.upload',
      'embedding.generate',
      'vector.search',
      'ocr.process',
    ];

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      this.logger.log(`Subscribed to topic: ${topic}`);
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    this.logger.log('Kafka consumer is running');
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    this.logger.log(
      `Received message from topic: ${topic}, partition: ${partition}`,
    );

    try {
      const value = message.value?.toString();
      if (!value) {
        this.logger.warn('Received empty message');
        return;
      }

      const data = JSON.parse(value);

      switch (topic) {
        case 'document.process':
          await this.handleProcessDocument(data);
          break;
        case 'document.search':
          await this.handleSearchDocument(data);
          break;
        case 'document.delete':
          await this.handleDeleteDocument(data);
          break;
        case 'document.upload':
          await this.handleDocumentUpload(data);
          break;
        case 'embedding.generate':
          await this.handleEmbeddingGenerate(data);
          break;
        case 'vector.search':
          await this.handleVectorSearch(data);
          break;
        case 'ocr.process':
          await this.handleOCRProcess(data);
          break;
        default:
          this.logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async handleProcessDocument(data: {
    taskId: string;
    source: string;
    options?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.log(`Processing document task: ${data.taskId}`);

    try {
      const result = await this.documentProcessingService.processDocument(
        data.source,
        data.options,
      );

      await this.publishResult('document.processed', {
        taskId: data.taskId,
        status: 'SUCCESS',
        result,
      });
    } catch (error) {
      await this.publishResult('document.processed', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleSearchDocument(data: {
    taskId: string;
    query: string;
    limit?: number;
    filter?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.log(`Searching documents task: ${data.taskId}`);

    try {
      const results = await this.documentProcessingService.searchSimilar(
        data.query,
        data.limit,
        data.filter,
      );

      await this.publishResult('document.search.results', {
        taskId: data.taskId,
        status: 'SUCCESS',
        results: results.map((r) => ({
          documentId: r.document.id,
          content: r.document.content,
          metadata: r.document.metadata,
          score: r.score,
        })),
      });
    } catch (error) {
      await this.publishResult('document.search.results', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleDeleteDocument(data: {
    taskId: string;
    documentIds: string[];
  }): Promise<void> {
    this.logger.log(`Deleting documents task: ${data.taskId}`);

    try {
      await this.documentProcessingService.deleteDocuments(data.documentIds);

      await this.publishResult('document.deleted', {
        taskId: data.taskId,
        status: 'SUCCESS',
      });
    } catch (error) {
      await this.publishResult('document.deleted', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleDocumentUpload(data: {
    taskId: string;
    url?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.log(`Processing document upload task: ${data.taskId}`);

    try {
      const source = data.url || data.content;
      if (!source) {
        throw new Error('Either url or content must be provided');
      }

      const result = await this.documentProcessingService.processDocument(
        source,
        {
          split: true,
          embed: true,
          store: true,
          metadata: data.metadata,
        },
      );

      await this.publishResult('document.uploaded', {
        taskId: data.taskId,
        status: 'SUCCESS',
        result,
      });
    } catch (error) {
      await this.publishResult('document.uploaded', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleEmbeddingGenerate(data: {
    taskId: string;
    text?: string;
    texts?: string[];
    provider?: string;
  }): Promise<void> {
    this.logger.log(`Generating embeddings task: ${data.taskId}`);

    try {
      if (!this.embedder) {
        throw new Error('Embedder not configured');
      }

      let embeddings: number[][];
      if (data.texts && data.texts.length > 0) {
        // Batch embedding generation
        embeddings = await this.embedder.embedBatch(data.texts);
      } else if (data.text) {
        // Single text embedding
        const embedding = await this.embedder.embedText(data.text);
        embeddings = [embedding];
      } else {
        throw new Error('Either text or texts must be provided');
      }

      await this.publishResult('embedding.generated', {
        taskId: data.taskId,
        status: 'SUCCESS',
        embeddings,
        count: embeddings.length,
      });
    } catch (error) {
      await this.publishResult('embedding.generated', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleVectorSearch(data: {
    taskId: string;
    queryEmbedding: number[];
    limit?: number;
    filter?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.log(`Vector search task: ${data.taskId}`);

    try {
      if (!this.vectorStore) {
        throw new Error('VectorStore not configured');
      }

      if (!data.queryEmbedding || data.queryEmbedding.length === 0) {
        throw new Error('queryEmbedding must be provided');
      }

      const results = await this.vectorStore.similaritySearch(
        data.queryEmbedding,
        data.limit || 5,
        data.filter,
      );

      await this.publishResult('vector.search.result', {
        taskId: data.taskId,
        status: 'SUCCESS',
        results: results.map((r) => ({
          documentId: r.document.id,
          content: r.document.content,
          metadata: r.document.metadata,
          score: r.score,
        })),
        count: results.length,
      });
    } catch (error) {
      await this.publishResult('vector.search.result', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleOCRProcess(data: {
    taskId: string;
    imagePath?: string;
    imageData?: string;
    language?: string;
    operation?: string;
  }): Promise<void> {
    this.logger.log(`OCR processing task: ${data.taskId}`);

    try {
      /**
       * PLACEHOLDER IMPLEMENTATION: OCR Processing
       * 
       * This is an intentional placeholder for OCR functionality.
       * A full implementation would integrate with Tesseract OCR or similar library
       * to extract text from images. The placeholder returns a mock result to allow
       * the system to function while OCR capabilities are developed.
       * 
       * Future implementation should:
       * - Install and configure Tesseract OCR library
       * - Process image data from imagePath or imageData
       * - Extract text with confidence scores
       * - Support multiple languages via language parameter
       * - Handle various image formats (PNG, JPEG, PDF, etc.)
       */
      await this.publishResult('ocr.complete', {
        taskId: data.taskId,
        status: 'SUCCESS',
        result: {
          text: `[OCR placeholder] Extracted text from ${data.imagePath || 'image data'}`,
          confidence: 0.95,
          language: data.language || 'eng',
        },
      });
    } catch (error) {
      await this.publishResult('ocr.complete', {
        taskId: data.taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async publishResult(
    topic: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            value: JSON.stringify(data),
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.log(`Published result to topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish result: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
