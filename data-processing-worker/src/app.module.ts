import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { DomainModule } from './domain/domain.module';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

/**
 * App Module - Root module for Data Processing Worker
 *
 * Architecture: Hexagonal/Clean Architecture
 *
 * Layers:
 * 1. Domain - Core business logic (entities, ports, value objects)
 * 2. Application - Use cases and orchestration (services, DTOs)
 * 3. Infrastructure - Adapters and implementations (loaders, embedders, vectorstores, controllers)
 *
 * Responsibilities:
 * - Document loading (10+ file formats)
 * - Text splitting (multiple strategies)
 * - Embedding generation (OpenAI, Google)
 * - Vector storage (MongoDB Atlas)
 * - Kafka integration for async processing
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb://localhost:27017/enginedge-documents',
      }),
    }),
    HealthModule,
    DomainModule,
    ApplicationModule,
    InfrastructureModule,
  ],
})
export class AppModule {}
