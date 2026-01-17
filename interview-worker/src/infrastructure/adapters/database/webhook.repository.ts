import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection, ObjectId } from 'mongodb';
import { Webhook } from '../../../domain/entities';

@Injectable()
export class MongoWebhookRepository implements OnModuleInit {
  private readonly logger = new Logger(MongoWebhookRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('webhooks');
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ events: 1 });
    await this.collection.createIndex({ id: 1 }, { unique: true });
    this.logger.log('MongoWebhookRepository initialized');
  }

  async save(webhook: Webhook): Promise<Webhook> {
    const doc = this.toDocument(webhook);
    await this.collection.insertOne(doc);
    return this.toEntity(doc);
  }

  async findById(id: string): Promise<Webhook | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(userId: string): Promise<Webhook[]> {
    const docs = await this.collection.find({ userId }).toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByEvent(event: string): Promise<Webhook[]> {
    const docs = await this.collection.find({ events: event }).toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async update(id: string, webhook: Partial<Webhook>): Promise<Webhook | null> {
    const updateDoc: any = { ...webhook };
    delete updateDoc.id; // Don't update the ID
    updateDoc.updatedAt = new Date();

    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result ? this.toEntity(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  private toDocument(webhook: Webhook): any {
    return {
      ...webhook,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      lastDeliveryAt: webhook.lastDeliveryAt,
    };
  }

  private toEntity(doc: any): Webhook {
    return {
      id: doc.id,
      userId: doc.userId,
      url: doc.url,
      secret: doc.secret,
      events: doc.events,
      enabled: doc.enabled,
      retryCount: doc.retryCount || 0,
      lastDeliveryAt: doc.lastDeliveryAt
        ? new Date(doc.lastDeliveryAt)
        : undefined,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    };
  }
}
