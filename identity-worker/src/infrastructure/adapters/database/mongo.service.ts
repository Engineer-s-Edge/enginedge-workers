import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db, Collection, IndexSpecification } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private db!: Db;

  async onModuleInit() {
    const uri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/identity-service';
    const dbName = process.env.MONGODB_DB || 'identity-service';
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(dbName);

    // Ensure indexes
    await this.ensureIndexes();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  collection<T>(name: string): Collection<T> {
    return this.db.collection<T>(name);
  }

  private async ensureIndexes() {
    await this.collection('users').createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      { key: { tenantId: 1 }, name: 'users_tenant_idx' },
    ] as IndexSpecification[] as any);
    await this.collection('oauth_accounts').createIndexes([
      {
        key: { provider: 1, providerUserId: 1 },
        name: 'oauth_provider_user_unique',
        unique: true,
      },
      { key: { userId: 1 }, name: 'oauth_user_idx' },
    ] as IndexSpecification[] as any);
    await this.collection('keys').createIndexes([
      { key: { kid: 1 }, name: 'keys_kid_unique', unique: true },
    ] as IndexSpecification[] as any);
  }
}
