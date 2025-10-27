/**
 * Database Module
 * 
 * Configures MongoDB connection and provides repositories
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Schemas
import { LaTeXDocumentSchema, LaTeXDocumentSchemaFactory } from './schemas/latex-document.schema';
import { LaTeXProjectSchema, LaTeXProjectSchemaFactory } from './schemas/latex-project.schema';
import { LaTeXTemplateSchema, LaTeXTemplateSchemaFactory } from './schemas/latex-template.schema';
import { CompilationJobSchema, CompilationJobSchemaFactory } from './schemas/compilation-job.schema';
import { PackageCacheSchema, PackageCacheSchemaFactory } from './schemas/package-cache.schema';

// Repositories
import { MongoDBDocumentRepository } from './repositories/document.repository';
import { MongoDBProjectRepository } from './repositories/project.repository';
import { MongoDBTemplateRepository } from './repositories/template.repository';
import { MongoDBPackageCacheRepository } from './repositories/package-cache.repository';

// Services
import { GridFSService } from './services/gridfs.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/latex-worker'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: LaTeXDocumentSchema.name, schema: LaTeXDocumentSchemaFactory },
      { name: LaTeXProjectSchema.name, schema: LaTeXProjectSchemaFactory },
      { name: LaTeXTemplateSchema.name, schema: LaTeXTemplateSchemaFactory },
      { name: CompilationJobSchema.name, schema: CompilationJobSchemaFactory },
      { name: PackageCacheSchema.name, schema: PackageCacheSchemaFactory },
    ]),
  ],
  providers: [
    MongoDBDocumentRepository,
    MongoDBProjectRepository,
    MongoDBTemplateRepository,
    MongoDBPackageCacheRepository,
    GridFSService,
  ],
  exports: [
    MongoDBDocumentRepository,
    MongoDBProjectRepository,
    MongoDBTemplateRepository,
    MongoDBPackageCacheRepository,
    GridFSService,
  ],
})
export class DatabaseModule {}
