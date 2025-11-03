/**
 * Knowledge Graph Adapter Interface
 *
 * Port interface for knowledge graph operations
 * Abstracts external KnowledgeGraphService implementation
 */

export interface ResearchFinding {
  topic: string;
  findings: string[];
  sources: string[];
  confidence: number;
  timestamp: Date;
  researchPhases?: string[];
}

export interface ResearchReport {
  topic: string;
  findings: string[];
  sources: string[];
  confidence: number;
}

export interface GraphStatistics {
  topicCount: number;
  sourceCount: number;
  avgConfidence: number;
  nodeCount: number;
  edgeCount: number;
  lastUpdated: Date;
}

export interface IKnowledgeGraphAdapter {
  /**
   * Add research finding to knowledge graph
   */
  addResearchFinding(data: ResearchFinding): Promise<{
    success: boolean;
    nodesAdded?: number;
  }>;

  /**
   * Get recent research reports for user
   */
  getRecentResearchReports(
    userId: string,
    limit: number,
  ): Promise<ResearchReport[]>;

  /**
   * Get comprehensive statistics
   */
  getStatistics(userId: string): Promise<GraphStatistics>;

  /**
   * Search for related topics
   */
  searchTopics(query: string): Promise<string[]>;

  /**
   * Get topic details
   */
  getTopicDetails(topic: string): Promise<any>;
}
