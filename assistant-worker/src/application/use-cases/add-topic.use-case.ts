/**
 * Add Topic Use Case
 *
 * Adds a topic to the catalog with automatic categorization.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { TopicCatalogService } from '../services/topic-catalog.service';
import { CreateTopicInput } from '../../domain/entities/topic-catalog.entity';
import { AddTopicResult } from '../services/topic-catalog.service';

@Injectable()
export class AddTopicUseCase {
  constructor(
    private readonly topicCatalogService: TopicCatalogService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  async execute(input: CreateTopicInput): Promise<AddTopicResult> {
    this.logger.info('Adding topic to catalog', { name: input.name });

    return this.topicCatalogService.addTopic(input);
  }
}
