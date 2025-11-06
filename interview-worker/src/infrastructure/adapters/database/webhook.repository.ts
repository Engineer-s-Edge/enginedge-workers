import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';

@Injectable()
export class MongoWebhookRepository implements OnModuleInit {
  private readonly logger = new Logger(MongoWebhookRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('webhooks');
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ event: 1 });
    this.logger.log('MongoWebhookRepository initialized');
  }

  async save(webhook: any): Promise<any> {
    await this.collection.insertOne(webhook);
    return webhook;
  }

  async findByUserId(userId: string): Promise<any[]> {
    return this.collection.find({ userId }).toArray();
  }

  async findByEvent(event: string): Promise<any[]> {
    return this.collection.find({ event }).toArray();
  }
}
