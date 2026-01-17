/**
 * MongoDB Module
 *
 * Configures MongoDB connection using native driver.
 * Provides a shared MongoDB client and database instance for repositories.
 */

import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Global,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db } from 'mongodb';

@Global()
@Module({
  providers: [
    {
      provide: 'MONGODB_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const mongoUri =
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/agent_tool_worker';
        const dbName =
          configService.get<string>('MONGODB_DATABASE') || 'agent_tool_worker';

        const client = new MongoClient(mongoUri, {
          maxPoolSize: 50,
          minPoolSize: 5,
          maxIdleTimeMS: 30000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: 'MONGODB_DB',
      useFactory: async (client: MongoClient, configService: ConfigService) => {
        const dbName =
          configService.get<string>('MONGODB_DATABASE') || 'agent_tool_worker';
        return client.db(dbName);
      },
      inject: ['MONGODB_CLIENT', ConfigService],
    },
  ],
  exports: ['MONGODB_CLIENT', 'MONGODB_DB'],
})
export class MongoDbModule implements OnModuleDestroy {
  constructor(
    @Inject('MONGODB_CLIENT')
    private readonly client: MongoClient,
  ) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
