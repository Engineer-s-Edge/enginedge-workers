/**
 * Knowledge Graph Adapter Implementation
 *
 * Bridges orchestrator with ResearchService (which uses KnowledgeGraphService)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IKnowledgeGraphAdapter,
  ResearchFinding,
  ResearchReport,
  GraphStatistics,
} from '../interfaces';
import { ResearchService } from '../../../application/services/research.service';

@Injectable()
export class KnowledgeGraphAdapter implements IKnowledgeGraphAdapter {
  private readonly logger = new Logger(KnowledgeGraphAdapter.name);

  constructor(private readonly researchService: ResearchService) {
    this.logger.log(
      'Knowledge Graph Adapter initialized with real ResearchService',
    );
  }

  async addResearchFinding(data: ResearchFinding): Promise<{
    success: boolean;
    nodesAdded?: number;
  }> {
    try {
      this.logger.log(`Adding research finding for topic: ${data.topic}`);
      return await this.researchService.addResearchFinding(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to add research finding: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async getRecentResearchReports(
    userId: string,
    limit: number,
  ): Promise<ResearchReport[]> {
    try {
      this.logger.log(`Fetching recent research reports for user ${userId}`);
      return await this.researchService.getRecentResearchReports(userId, limit);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to fetch research reports: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async getStatistics(userId: string): Promise<GraphStatistics> {
    try {
      this.logger.log(`Getting statistics for user ${userId}`);
      return await this.researchService.getStatistics(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get statistics: ${err.message}`, err.stack);
      throw error;
    }
  }

  async searchTopics(query: string): Promise<string[]> {
    try {
      this.logger.log(`Searching topics for query: ${query}`);
      return await this.researchService.searchTopics(query);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to search topics: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getTopicDetails(topic: string): Promise<Record<string, unknown>> {
    try {
      this.logger.log(`Getting details for topic: ${topic}`);
      return await this.researchService.getTopicDetails(topic);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get topic details: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
