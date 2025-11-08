/**
 * Get Topics for Research Use Case
 *
 * Returns topics that need research, for use by genius/expert agents.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { TopicCatalogService } from '../services/topic-catalog.service';
import {
  TopicCatalogEntry,
  TopicStatus,
} from '../../domain/entities/topic-catalog.entity';

export interface GetTopicsForResearchInput {
  limit?: number;
  category?: string;
  status?: TopicStatus;
  minPriority?: number;
}

@Injectable()
export class GetTopicsForResearchUseCase {
  constructor(
    private readonly topicCatalogService: TopicCatalogService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  async execute(
    input: GetTopicsForResearchInput = {},
  ): Promise<TopicCatalogEntry[]> {
    this.logger.info('Getting topics for research', input);

    const { limit = 10, category, status, minPriority } = input;

    // If category specified, get topics by category
    if (category) {
      const topics =
        await this.topicCatalogService.getTopicsByCategory(category);
      return this.filterTopics(topics, { status, minPriority, limit });
    }

    // If status specified, get topics by status
    if (status) {
      if (
        status === TopicStatus.NOT_STARTED ||
        status === TopicStatus.NEEDS_REFRESH
      ) {
        const topics =
          await this.topicCatalogService.getTopicsNeedingResearch(limit);
        return this.filterTopics(topics, { minPriority });
      }

      // For other statuses, we'd need to add a method to repository
      // For now, get by priority and filter
      const topics = await this.topicCatalogService.getTopicsByPriority(limit);
      return topics.filter(
        (t) =>
          t.status === status &&
          (!minPriority || t.researchPriority >= minPriority),
      );
    }

    // Default: get topics needing research by priority
    const topics = await this.topicCatalogService.getTopicsByPriority(limit);
    return this.filterTopics(topics, { minPriority });
  }

  private filterTopics(
    topics: TopicCatalogEntry[],
    filters: { status?: TopicStatus; minPriority?: number; limit?: number },
  ): TopicCatalogEntry[] {
    let filtered = topics;

    if (filters.status) {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    if (filters.minPriority !== undefined) {
      filtered = filtered.filter(
        (t) => t.researchPriority >= filters.minPriority!,
      );
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }
}
