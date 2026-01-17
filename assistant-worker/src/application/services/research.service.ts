/**
 * Research Service
 *
 * Manages research findings and reports, integrating with KnowledgeGraphService
 * to store research data as knowledge graph nodes.
 */

import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { KnowledgeGraphService } from './knowledge-graph.service';
import {
  ResearchFinding,
  ResearchReport,
  GraphStatistics,
} from '../../infrastructure/adapters/interfaces/knowledge-graph.adapter.interface';
import {
  ICSLayer,
  KGNode,
} from '../../infrastructure/adapters/knowledge-graph/neo4j.adapter';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private reportStore: Map<string, ResearchReport[]> = new Map(); // userId -> reports

  constructor(
    @Inject('ILogger') private readonly appLogger: ILogger,
    private readonly knowledgeGraphService: KnowledgeGraphService,
  ) {}

  /**
   * Add research finding to knowledge graph
   */
  async addResearchFinding(
    data: ResearchFinding,
    userId?: string,
  ): Promise<{ success: boolean; nodesAdded?: number }> {
    try {
      this.logger.log(`Adding research finding for topic: ${data.topic}`);

      const nodesCreated: string[] = [];

      // Create a node for each finding
      for (const finding of data.findings) {
        const node = await this.knowledgeGraphService.addNode(
          finding,
          'research_finding',
          ICSLayer.L3_MODELS, // Research findings are typically at models layer
          {
            topic: data.topic,
            confidence: data.confidence || 0.8,
            timestamp: data.timestamp || new Date(),
            sources: data.sources || [],
            researchPhases: data.researchPhases || [],
            userId: userId,
          },
        );
        nodesCreated.push(node.id);
      }

      // Create a topic node if it doesn't exist
      const topicNode = await this.knowledgeGraphService.addNode(
        data.topic,
        'topic',
        ICSLayer.L2_PATTERNS, // Topics are patterns
        {
          confidence: data.confidence || 0.8,
          timestamp: data.timestamp || new Date(),
          sources: data.sources || [],
          userId: userId,
        },
      );
      nodesCreated.push(topicNode.id);

      // Create relationships between topic and findings
      for (const findingNodeId of nodesCreated.slice(0, -1)) {
        // Skip the topic node (last one)
        await this.knowledgeGraphService.createRelationship(
          topicNode.id,
          findingNodeId,
          'HAS_FINDING',
          {
            confidence: data.confidence || 0.8,
            timestamp: new Date(),
          },
        );
      }

      // Create source nodes and link them
      for (const source of data.sources || []) {
        const sourceNode = await this.knowledgeGraphService.addNode(
          source,
          'source',
          ICSLayer.L1_OBSERVATIONS, // Sources are observations
          {
            url: source,
            timestamp: data.timestamp || new Date(),
            userId: userId,
          },
        );

        // Link source to topic
        await this.knowledgeGraphService.createRelationship(
          sourceNode.id,
          topicNode.id,
          'CITES',
          {
            timestamp: new Date(),
          },
        );
      }

      this.logger.log(
        `Added ${nodesCreated.length} nodes to knowledge graph for topic: ${data.topic}`,
      );

      return {
        success: true,
        nodesAdded: nodesCreated.length,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to add research finding: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Store a research report for a user
   */
  async storeResearchReport(
    userId: string,
    report: ResearchReport,
  ): Promise<void> {
    if (!this.reportStore.has(userId)) {
      this.reportStore.set(userId, []);
    }
    const reports = this.reportStore.get(userId)!;
    reports.unshift(report); // Add to beginning
    // Keep only last 100 reports per user
    if (reports.length > 100) {
      reports.splice(100);
    }
  }

  /**
   * Get recent research reports for a user
   */
  async getRecentResearchReports(
    userId: string,
    limit: number,
  ): Promise<ResearchReport[]> {
    const reports = this.reportStore.get(userId) || [];
    return reports.slice(0, limit);
  }

  /**
   * Get comprehensive statistics from knowledge graph
   */
  async getStatistics(userId?: string): Promise<GraphStatistics> {
    try {
      // Get all nodes (optionally filtered by userId if provided)
      const { nodes, total: nodeCount } =
        await this.knowledgeGraphService.getAllNodes();

      // Get all edges
      const { total: edgeCount } =
        await this.knowledgeGraphService.getAllEdges();

      // Filter by userId if provided
      const userNodes = userId
        ? nodes.filter((n) => n.properties?.userId === userId)
        : nodes;

      // Extract unique topics
      const topics = new Set<string>();
      const sources = new Set<string>();
      let totalConfidence = 0;
      let confidenceCount = 0;

      userNodes.forEach((node) => {
        if (node.type === 'topic') {
          topics.add(node.label);
        }
        if (node.type === 'source') {
          sources.add(node.label);
        }
        if (node.properties?.confidence !== undefined) {
          totalConfidence += node.properties.confidence as number;
          confidenceCount++;
        }
      });

      return {
        topicCount: topics.size,
        sourceCount: sources.size,
        avgConfidence:
          confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        nodeCount: userNodes.length,
        edgeCount: userId ? edgeCount : edgeCount, // Could filter edges by userId if needed
        lastUpdated: new Date(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get statistics: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Search for topics in knowledge graph
   */
  async searchTopics(query: string, userId?: string): Promise<string[]> {
    try {
      // Get all topic nodes
      const topicNodes =
        await this.knowledgeGraphService.getNodesByType('topic');

      // Filter by userId if provided
      const userTopicNodes = userId
        ? topicNodes.filter((n) => n.properties?.userId === userId)
        : topicNodes;

      // Simple text search
      const queryLower = query.toLowerCase();
      const matchingTopics = userTopicNodes
        .filter((node) => node.label.toLowerCase().includes(queryLower))
        .map((node) => node.label);

      return matchingTopics;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to search topics: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get topic details from knowledge graph
   */
  async getTopicDetails(
    topic: string,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    try {
      // Get all topic nodes
      const topicNodes =
        await this.knowledgeGraphService.getNodesByType('topic');

      // Find the specific topic
      const topicNode = topicNodes.find(
        (n) =>
          n.label.toLowerCase() === topic.toLowerCase() &&
          (!userId || n.properties?.userId === userId),
      );

      if (!topicNode) {
        return {
          topic,
          nodeCount: 0,
          sources: [],
          avgConfidence: 0,
          lastUpdated: new Date(),
        };
      }

      // Get related findings (nodes connected via outgoing edges)
      const relatedNodes = await this.knowledgeGraphService.getNeighbors(
        topicNode.id,
        'out',
      );

      // Extract sources from related nodes
      const sources = new Set<string>();
      let totalConfidence = 0;
      let confidenceCount = 0;

      relatedNodes.forEach((node) => {
        if (node.type === 'source' && node.label) {
          sources.add(node.label);
        }
        if (node.properties?.confidence !== undefined) {
          totalConfidence += node.properties.confidence as number;
          confidenceCount++;
        }
      });

      return {
        topic,
        nodeId: topicNode.id,
        nodeCount: relatedNodes.length,
        sources: Array.from(sources),
        avgConfidence:
          confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        lastUpdated: (topicNode.properties?.timestamp as Date) || new Date(),
        confidence: topicNode.properties?.confidence || 0,
      };
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
