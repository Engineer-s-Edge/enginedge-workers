import { Injectable } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';
import { SigningKey } from '../../../domain/entities/key.entity';

@Injectable()
export class KeyRepository {
  constructor(private readonly mongo: MongoService) {}

  async getActiveKey(): Promise<SigningKey | null> {
    return this.mongo
      .collection<SigningKey>('keys')
      .findOne({}, { sort: { createdAt: -1 } } as any);
  }

  async saveKey(key: SigningKey): Promise<void> {
    await this.mongo.collection<SigningKey>('keys').insertOne(key as any);
  }
}
