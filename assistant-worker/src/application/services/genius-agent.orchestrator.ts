/**
 * Genius Agent Orchestrator Service
 *
 * Phase 5e.3: Infrastructure Layer Integration
 *
 * This service bridges the hexagonal architecture services from enginedge-core
 * with the assistant-worker infrastructure.
 *
 * Responsibilities:
 * - Orchestrate complete learning cycles
 * - Analyze patterns and detect knowledge gaps
 * - Calculate adaptive strategies
 * - Manage expert agent creation
 * - Coordinate with infrastructure services
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgeGraphAdapter,
  ValidationAdapter,
  ExpertPoolAdapter,
  TopicCatalogAdapter,
  LearningModeAdapter,
  ScheduledLearningAdapter,
  NewsIntegrationAdapter,
} from '../../infrastructure/adapters/implementations';

interface KnowledgeGap {
  topic: string;
  gapScore: number;
  priority: number;
}

@Injectable()
export class GeniusAgentOrchestrator {
  private readonly logger = new Logger(GeniusAgentOrchestrator.name);

  constructor(
    private readonly knowledgeGraphAdapter: KnowledgeGraphAdapter,
    private readonly validationAdapter: ValidationAdapter,
    private readonly expertPoolAdapter: ExpertPoolAdapter,
    private readonly topicCatalogAdapter: TopicCatalogAdapter,
    private readonly learningModeAdapter: LearningModeAdapter,
    private readonly scheduledLearningAdapter: ScheduledLearningAdapter,
    private readonly newsIntegrationAdapter: NewsIntegrationAdapter,
  ) {}

  /**
   * Execute complete user-directed learning cycle
   */
  async executeUserDirectedLearning(
    userId: string,
    topics: Array<{
      topic: string;
      complexity: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
    }>,
  ): Promise<any> {
    this.logger.log(
      `Starting user-directed learning for ${userId}: ${topics.map((t) => t.topic).join(', ')}`,
    );

    const startTime = Date.now();

    try {
      // Step 1: Set learning mode to user-directed
      await this.learningModeAdapter.executeLearningMode({
        userId,
        mode: 'user-directed',
        topics: topics.map((t) => t.topic),
        detectedGaps: [],
        cronSchedule: undefined,
      });

      // Step 2: Allocate experts for requested complexity levels
      const maxComplexity = Math.max(
        ...topics.map((t) => parseInt(t.complexity.substring(1))),
      );
      const expertAllocation = await this.expertPoolAdapter.allocateExperts({
        count: topics.length,
        specialization: topics[0]?.topic || 'general',
        complexity: topics[0]?.complexity || 'L3',
        expertise: topics.map((t) => t.topic),
      });

      // Step 3: Fetch news and recent research for each topic
      const newsResults = await Promise.all(
        topics.map((t) =>
          this.newsIntegrationAdapter.fetchRecentNews(t.topic, 10),
        ),
      );

      // Step 4: Add topics to catalog and track research
      await Promise.all(
        topics.map((t) =>
          this.topicCatalogAdapter.addTopic(t.topic, {
            description: `User-directed research on ${t.topic}`,
            complexity: t.complexity,
            lastResearched: new Date(),
            researchCount: 1,
          }),
        ),
      );

      // Step 5: Analyze trends and generate reports
      const trendingTopics =
        await this.topicCatalogAdapter.getTrendingTopics(5);
      const knowledgeBase =
        await this.knowledgeGraphAdapter.getStatistics(userId);

      // Step 6: Compile results
      const duration = Date.now() - startTime;

      this.logger.log(
        `User-directed learning completed for ${userId} in ${duration}ms: ${expertAllocation.allocated.length} experts allocated`,
      );

      return {
        success: true,
        sessionId: `session-${Date.now()}`,
        userId,
        topicsProcessed: topics.map((t) => t.topic),
        expertReports: expertAllocation.allocated,
        newsArticles: newsResults.flat().length,
        trendingTopics,
        knowledgeGraphStats: knowledgeBase,
        metrics: {
          topicsRequested: topics.length,
          expertsAllocated: expertAllocation.allocated.length,
          articlesFetched: newsResults.flat().length,
        },
        duration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `User-directed learning failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Execute complete autonomous learning cycle
   */
  async executeAutonomousLearning(
    userId: string,
    options?: {
      maxTopics?: number;
      minPriority?: number;
      maxComplexity?: number;
    },
  ): Promise<any> {
    this.logger.log(`Starting autonomous learning for ${userId}`);

    const startTime = Date.now();

    try {
      // Step 1: Detect knowledge gaps from recent research
      const gaps = await this.detectKnowledgeGaps(userId);

      // Step 2: Filter gaps based on options
      const filteredGaps = gaps
        .slice(0, options?.maxTopics || 10)
        .filter((g) => g.priority >= (options?.minPriority || 0));

      if (filteredGaps.length === 0) {
        this.logger.log(`No knowledge gaps detected for ${userId}`);
        return {
          success: true,
          sessionId: `session-${Date.now()}`,
          topicsProcessed: [],
          gapsAddressed: 0,
          expertReports: [],
          metrics: { noGapsDetected: true },
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Set learning mode to autonomous
      await this.learningModeAdapter.executeLearningMode({
        userId,
        mode: 'autonomous',
        topics: filteredGaps.map((g) => g.topic),
        detectedGaps: filteredGaps,
        cronSchedule: undefined,
      });

      // Step 4: Allocate experts for gap topics
      const expertAllocation = await this.expertPoolAdapter.allocateExperts({
        count: filteredGaps.length,
        specialization: filteredGaps[0]?.topic || 'general',
        complexity: 'L3',
        expertise: filteredGaps.map((g) => g.topic),
      });

      // Step 5: Fetch news for gap topics
      const newsResults = await Promise.all(
        filteredGaps.map((g) =>
          this.newsIntegrationAdapter.fetchRecentNews(g.topic, 10),
        ),
      );

      // Step 6: Track research on gap topics
      await Promise.all(
        filteredGaps.map((g) =>
          this.topicCatalogAdapter.trackResearch(g.topic, {
            type: 'autonomous_research',
            gapScore: g.gapScore,
            priority: g.priority,
            timestamp: new Date(),
          }),
        ),
      );

      // Step 7: Compile results
      const duration = Date.now() - startTime;

      this.logger.log(
        `Autonomous learning completed for ${userId} in ${duration}ms: ${filteredGaps.length} gaps addressed`,
      );

      return {
        success: true,
        sessionId: `session-${Date.now()}`,
        userId,
        topicsProcessed: filteredGaps.map((g) => g.topic),
        gapsAddressed: filteredGaps.length,
        expertReports: expertAllocation.allocated,
        newsArticles: newsResults.flat().length,
        metrics: {
          gapsDetected: gaps.length,
          gapsAddressed: filteredGaps.length,
          expertsAllocated: expertAllocation.allocated.length,
          articlesFetched: newsResults.flat().length,
        },
        duration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Autonomous learning failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Analyze patterns in existing research and detect knowledge gaps
   */
  async detectKnowledgeGaps(userId: string): Promise<KnowledgeGap[]> {
    this.logger.log(`Analyzing knowledge gaps for ${userId}`);

    try {
      // Step 1: Fetch recent research reports
      const recentReports =
        await this.knowledgeGraphAdapter.getRecentResearchReports(userId, 20);

      // Step 2: Get trending topics in news
      const trendingTopics =
        await this.newsIntegrationAdapter.getTrendingTopics(15);
      const trendingTopicNames = trendingTopics.map((t) => t.topic);

      // Step 3: Analyze current knowledge base
      const stats = await this.knowledgeGraphAdapter.getStatistics(userId);

      // Step 4: Calculate gaps as topics not in knowledge base but trending
      const coveredTopics = new Set(recentReports.map((r) => r.topic));
      const gaps: KnowledgeGap[] = trendingTopicNames
        .filter((t) => !coveredTopics.has(t))
        .map((topic, index) => ({
          topic,
          gapScore: Math.random() * 100,
          priority: 100 - index * 5,
        }))
        .sort((a, b) => b.priority - a.priority);

      this.logger.log(`Detected ${gaps.length} knowledge gaps for ${userId}`);
      return gaps;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Knowledge gap analysis failed: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Calculate adaptive learning strategy
   */
  async calculateAdaptiveStrategy(
    topics: Array<{
      topic: string;
      researchGap: number;
      priority: number;
      complexity: number;
    }>,
    context?: { systemLoad?: number; availableResources?: number },
  ): Promise<any> {
    this.logger.log(
      `Calculating adaptive strategy for ${topics.length} topics`,
    );

    try {
      // Sort topics by priority and complexity
      const sortedTopics = [...topics].sort((a, b) => b.priority - a.priority);

      // Calculate batch size based on complexity
      const avgComplexity =
        topics.reduce((sum, t) => sum + t.complexity, 0) / topics.length;
      const batchSize = Math.max(1, Math.floor(10 / avgComplexity));

      // Allocate experts based on complexity distribution
      const complexityBuckets = topics.reduce(
        (acc, t) => {
          const level = `L${t.complexity}`;
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Recommend learning mode based on gap scores
      const avgGapScore =
        topics.reduce((sum, t) => sum + t.researchGap, 0) / topics.length;
      const recommendedMode = avgGapScore > 50 ? 'autonomous' : 'user-directed';

      // Calculate escalation thresholds
      const maxGap = Math.max(...topics.map((t) => t.researchGap));
      const escalationThresholds = {
        confidence: 0.6,
        gap: maxGap * 0.75,
        complexity: Math.max(...topics.map((t) => t.complexity)),
      };

      this.logger.log(
        `Adaptive strategy calculated: batchSize=${batchSize}, mode=${recommendedMode}, thresholds=${JSON.stringify(escalationThresholds)}`,
      );

      return {
        topicPriorities: sortedTopics,
        expertAllocations: complexityBuckets,
        batchSize,
        recommendedMode,
        escalationThresholds,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Strategy calculation failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Validate expert research reports
   */
  async validateResearchReports(reports: any[]): Promise<any> {
    this.logger.log(`Validating ${reports.length} research reports`);

    try {
      // Step 1: Batch validate all reports using validation adapter
      const validationConfigs = reports.map((r) => ({
        sources: r.sources || [],
        findings: r.findings || [],
        confidence: r.confidence || 0,
        topic: r.topic || 'unknown',
      }));

      const validationResults =
        await this.validationAdapter.validateBatch(validationConfigs);

      // Step 2: Compile results with original report data
      const enrichedResults = validationResults.map((vr, idx) => ({
        ...reports[idx],
        validation: vr,
        isValid: vr.isValid,
        validationScore: vr.score,
      }));

      const passCount = enrichedResults.filter((r) => r.isValid).length;
      const failCount = enrichedResults.length - passCount;

      this.logger.log(
        `Validation complete: ${passCount} passed, ${failCount} failed`,
      );

      return {
        totalReports: enrichedResults.length,
        passed: passCount,
        failed: failCount,
        successRate: (passCount / enrichedResults.length) * 100,
        results: enrichedResults,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Validation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Integrate validated research into knowledge base
   */
  async integrateResearchResults(validatedReports: any[]): Promise<any> {
    this.logger.log(
      `Integrating ${validatedReports.length} validated reports into knowledge graph`,
    );

    try {
      // Step 1: Filter only valid reports
      const validReports = validatedReports.filter(
        (r) => r.isValid || r.validation?.isValid,
      );

      if (validReports.length === 0) {
        this.logger.log('No valid reports to integrate');
        return {
          topicsIntegrated: 0,
          nodesAdded: 0,
          timestamp: new Date(),
          details: [],
        };
      }

      // Step 2: Add each research finding to knowledge graph
      const integrationResults = await Promise.all(
        validReports.map((r) =>
          this.knowledgeGraphAdapter
            .addResearchFinding({
              topic: r.topic,
              findings: r.findings || [],
              sources: r.sources || [],
              confidence: r.confidence || 0,
              timestamp: new Date(),
              researchPhases: ['research', 'validation', 'integration'],
            })
            .catch(() => ({ success: false, nodesAdded: 0 })),
        ),
      );

      // Step 3: Track research in topic catalog
      await Promise.all(
        validReports.map((r) =>
          this.topicCatalogAdapter
            .trackResearch(r.topic, {
              type: 'expert_research',
              findings: r.findings?.length || 0,
              sources: r.sources?.length || 0,
              confidence: r.confidence || 0,
              timestamp: new Date(),
            })
            .catch(() => false),
        ),
      );

      // Step 4: Calculate metrics
      const successCount = integrationResults.filter((r) => r.success).length;
      const totalNodes = integrationResults.reduce(
        (sum, r) => sum + (r.nodesAdded || 0),
        0,
      );

      this.logger.log(
        `Integration complete: ${successCount} topics integrated, ${totalNodes} new nodes added`,
      );

      return {
        topicsIntegrated: successCount,
        nodesAdded: totalNodes,
        timestamp: new Date(),
        details: validReports,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Integration failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get learning session statistics
   */
  async getStatistics(userId: string): Promise<any> {
    try {
      // Step 1: Get knowledge graph statistics
      const graphStats = await this.knowledgeGraphAdapter.getStatistics(userId);

      // Step 2: Get recent research reports
      const recentReports =
        await this.knowledgeGraphAdapter.getRecentResearchReports(userId, 20);

      // Step 3: Detect knowledge gaps
      const gaps = await this.detectKnowledgeGaps(userId);

      // Step 4: Get recommended topics
      const recommendedTopics =
        await this.topicCatalogAdapter.getRecommendedTopics(userId, 5);

      // Step 5: Get trending topics
      const trendingTopics =
        await this.topicCatalogAdapter.getTrendingTopics(5);

      // Step 6: Get available experts
      const availableExperts =
        await this.expertPoolAdapter.getAvailableExperts();

      return {
        userId,
        graphStatistics: graphStats,
        totalTopicsCovered: graphStats.topicCount,
        totalSources: graphStats.sourceCount,
        averageConfidence: graphStats.avgConfidence,
        graphSize: {
          nodes: graphStats.nodeCount,
          edges: graphStats.edgeCount,
        },
        recentResearch: {
          count: recentReports.length,
          topics: recentReports.map((r) => r.topic),
        },
        knowledgeGaps: {
          detected: gaps.length,
          topGaps: gaps.slice(0, 5),
        },
        recommendations: {
          topics: recommendedTopics,
          trending: trendingTopics,
        },
        expertResources: {
          available: availableExperts.length,
          totalCapacity: 50,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Statistics retrieval failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
