import { Injectable } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';

interface RefreshTokenDoc {
  jti: string;
  userId: string;
  revoked: boolean;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly mongo: MongoService) {}

  async isRevoked(jti: string): Promise<boolean> {
    const doc = await this.mongo.collection<RefreshTokenDoc>('refresh_tokens').findOne({ jti });
    return !!doc?.revoked;
  }

  async revoke(jti: string): Promise<void> {
    await this.mongo
      .collection<RefreshTokenDoc>('refresh_tokens')
      .updateOne({ jti }, { $set: { revoked: true } }, { upsert: true });
  }

  async record(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.mongo
      .collection<RefreshTokenDoc>('refresh_tokens')
      .updateOne(
        { jti },
        { $setOnInsert: { jti, userId, createdAt: new Date() }, $set: { revoked: false, expiresAt } },
        { upsert: true },
      );
  }
}


