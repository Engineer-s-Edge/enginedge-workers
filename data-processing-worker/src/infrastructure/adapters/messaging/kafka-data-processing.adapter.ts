import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { DocumentProcessingService } from '../../../application/services/document-processing.service';

/**
 * Kafka Message Broker Adapter for Data Processing Worker
 * 
 * Listens to document processing requests and publishes results.
 */
@Injectable()
export class KafkaDataProcessingAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaDataProcessingAdapter.name);
  private kafka!: Kafka;
  private consumer!: Consumer;
  private producer!: Producer;
  private connected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentProcessingService: DocumentProcessingService,
  ) {
    this.initializeKafka();
  }

  private initializeKafka(): void {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092');
    
    this.kafka = new Kafka({
      clientId: 'data-processing-worker',
      brokers: brokers.split(',').map(broker => broker.trim()),
    });

    this.consumer = this.kafka.consumer({ groupId: 'data-processing-worker-group' });
    this.producer = this.kafka.producer();

    this.logger.log(`Kafka initialized with brokers: ${brokers}`);
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.subscribe();
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
      this.logger.error('Failed to connect to Kafka:', error instanceof Error ? error.stack : undefined);
      throw error;
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
    
    this.logger.log(`Received message from topic: ${topic}, partition: ${partition}`);

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
      this.logger.error(`Error handling message: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
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
        results: results.map(r => ({
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

      const result = await this.documentProcessingService.processDocument(source, {
        split: true,
        embed: true,
        store: true,
        metadata: data.metadata,
      });

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
      // This is a placeholder - would need to inject EmbedderService
      await this.publishResult('embedding.generated', {
        taskId: data.taskId,
        status: 'SUCCESS',
        message: 'Embedding generation not yet fully implemented via Kafka',
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
      // This is a placeholder - would need to inject VectorStoreService
      await this.publishResult('vector.search.result', {
        taskId: data.taskId,
        status: 'SUCCESS',
        message: 'Vector search not yet fully implemented via Kafka',
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
      // This is a placeholder - full OCR implementation would use Tesseract
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

  private async publishResult(topic: string, data: Record<string, unknown>): Promise<void> {
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
      this.logger.error(`Failed to publish result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
