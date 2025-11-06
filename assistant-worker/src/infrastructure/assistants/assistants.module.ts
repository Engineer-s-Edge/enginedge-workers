/**
 * Assistants Module
 *
 * Infrastructure module for assistants functionality
 * Wires together all assistant-related components
 */

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationModule } from '@application/application.module';
import { AssistantsController } from '../controllers/assistants.controller';
import { AssistantsService } from '@application/services/assistants.service';
import { AssistantsCrudService } from '@application/services/assistants-crud.service';
import { AssistantExecutorService } from '@application/services/assistant-executor.service';
import { MongoDBAssistantRepository } from '../adapters/storage/mongodb-assistant.repository';
import {
  AssistantDocument,
  AssistantSchema,
} from '../adapters/storage/assistant.schema';
import { IAssistantRepository } from '@application/ports/assistant.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssistantDocument.name, schema: AssistantSchema },
    ]),
    forwardRef(() => ApplicationModule),
  ],
  controllers: [AssistantsController],
  providers: [
    AssistantsService,
    // AssistantsCrudService and AssistantExecutorService are provided by ApplicationModule
    {
      provide: 'IAssistantRepository',
      useClass: MongoDBAssistantRepository,
    },
    MongoDBAssistantRepository,
  ],
  exports: [AssistantsService, 'IAssistantRepository'],
})
export class AssistantsModule {}
