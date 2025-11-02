/**
 * MongoDB Module
 * 
 * Configures MongoDB connection using native driver.
 * Provides a shared MongoDB client and database instance for repositories.
 */

import { Module, OnModuleInit, OnModuleDestroy, Global, Inject } from '@nestjs/common';
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
          'mongodb://localhost:27017/interview_worker';
        const dbName =
          configService.get<string>('MONGODB_DATABASE') || 'interview_worker';

        const client = new MongoClient(mongoUri, {
          maxPoolSize: 50, // Support up to 50 concurrent database connections for multiple simultaneous interviews
          minPoolSize: 5, // Keep minimum 5 connections ready
          maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
          serverSelectionTimeoutMS: 5000, // Timeout for server selection
          socketTimeoutMS: 45000, // Socket timeout
        });

        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: 'MONGODB_DB',
      useFactory: async (
        client: MongoClient,
        configService: ConfigService,
      ) => {
        const dbName =
          configService.get<string>('MONGODB_DATABASE') || 'interview_worker';
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

