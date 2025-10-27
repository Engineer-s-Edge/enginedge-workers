/**
 * Knowledge Graph Adapter Implementation
 * 
 * Bridges orchestrator with KnowledgeGraphService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IKnowledgeGraphAdapter,
  ResearchFinding,
  ResearchReport,
  GraphStatistics,
} from '../interfaces';

@Injectable()
export class KnowledgeGraphAdapter implements IKnowledgeGraphAdapter {
  private readonly logger = new Logger(KnowledgeGraphAdapter.name);
  private graphStore: Map<string, Record<string, unknown>[]> = new Map();
  private reportStore: Map<string, ResearchReport[]> = new Map();
  private topicStats: Map<string, TopicStat> = new Map();

  constructor() {
    // Initialize with sample data
    this.initializeStore();
  }

  private initializeStore(): void {
    // Initialize topic statistics
    const sampleTopics = ['AI', 'ML', 'NLP', 'Computer Vision', 'Reinforcement Learning'];
    sampleTopics.forEach(topic => {
      this.topicStats.set(topic, {
        count: 0,
        lastUpdated: new Date(),
        confidence: 0.85,
        sources: [],
      });
    });
  }

  async addResearchFinding(data: ResearchFinding): Promise<{
    success: boolean;
    nodesAdded?: number;
  }> {
    try {
      this.logger.log(`Adding research finding for topic: ${data.topic}`);

      // Store finding in graph
      const nodeId = `node-${Date.now()}-${Math.random()}`;
      const nodes = data.findings.map((f, i) => ({
        id: `${nodeId}-${i}`,
        label: f,
        type: 'finding',
        topic: data.topic,
        confidence: data.confidence || 0.8,
      }));

      // Add metadata node
      const metadataNode = {
        id: `${nodeId}-metadata`,
        label: `Metadata: ${data.topic}`,
        type: 'metadata',
        topic: data.topic,
        confidence: data.confidence || 0.8,
        timestamp: data.timestamp,
        sources: data.sources,
      };
      nodes.push(metadataNode);

      // Add to store
      this.graphStore.set(nodeId, nodes);

      // Update topic statistics
      const topicKey = data.topic;
      let stats = this.topicStats.get(topicKey);
      if (!stats) {
        stats = {
          count: 0,
          sources: [],
          confidence: 0.85,
          lastUpdated: new Date(),
        };
      }
      stats.count = (stats.count || 0) + nodes.length;
      stats.lastUpdated = new Date();
      stats.sources = Array.from(new Set([...stats.sources, ...(data.sources || [])]));
      this.topicStats.set(topicKey, stats);

      this.logger.log(`Added ${nodes.length} nodes to graph for topic: ${data.topic}`);

      return {
        success: true,
        nodesAdded: nodes.length,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to add research finding: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getRecentResearchReports(userId: string, limit: number): Promise<ResearchReport[]> {
    try {
      this.logger.log(`Fetching recent research reports for user ${userId}`);

      // Return stored reports or empty array
      const userReports = this.reportStore.get(userId) || [];
      return userReports.slice(0, limit);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to fetch research reports: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getStatistics(userId: string): Promise<GraphStatistics> {
    try {
      this.logger.log(`Getting statistics for user ${userId}`);

      // Calculate stats from stored data
      const topicsCount = this.topicStats.size;
      let totalSources = 0;
      let totalConfidence = 0;
      let confideCount = 0;
      let nodesCount = 0;
      let edgesCount = 0;

      this.topicStats.forEach(stats => {
        totalSources += stats.sources.length;
        totalConfidence += stats.confidence;
        confideCount++;
        nodesCount += stats.count;
        edgesCount += (stats.count > 0 ? stats.count - 1 : 0);
      });

      return {
        topicCount: topicsCount,
        sourceCount: totalSources,
        avgConfidence: confideCount > 0 ? totalConfidence / confideCount : 0,
        nodeCount: nodesCount,
        edgeCount: edgesCount,
        lastUpdated: new Date(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get statistics: ${err.message}`, err.stack);
      throw error;
    }
  }

  async searchTopics(query: string): Promise<string[]> {
    try {
      this.logger.log(`Searching topics for query: ${query}`);

      // Simple search: find topics matching query
      const results: string[] = [];
      this.topicStats.forEach((stats, topic) => {
        if (topic.toLowerCase().includes(query.toLowerCase())) {
          results.push(topic);
        }
      });

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to search topics: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getTopicDetails(topic: string): Promise<Record<string, unknown>> {
    try {
      this.logger.log(`Getting details for topic: ${topic}`);

      const stats = this.topicStats.get(topic);
      const defaultStats = {
        count: 0,
        sources: [],
        confidence: 0,
        lastUpdated: new Date(),
      };

      const topicData = stats || defaultStats;

      return {
        topic,
        nodeCount: topicData.count,
        sources: topicData.sources,
        avgConfidence: topicData.confidence,
        lastUpdated: topicData.lastUpdated,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get topic details: ${err.message}`, err.stack);
      throw error;
    }
  }
}

interface TopicStat {
  count: number;
  sources: string[];
  confidence: number;
  lastUpdated: Date;
}
