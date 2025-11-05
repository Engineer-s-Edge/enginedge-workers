/**
 * Knowledge Graph Service
 *
 * Orchestrates knowledge graph operations for Expert and Genius agents.
 * Supports ICS (Integrated Concept Synthesis) methodology.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import {
  Neo4jAdapter,
  ICSLayer,
  KGNode,
  KGEdge,
  QueryResult,
  ResearchStatus,
  SourceCitation,
  ResearchData,
} from '@infrastructure/adapters/knowledge-graph/neo4j.adapter';
import { GraphComponentService } from './graph-component.service';

/**
 * Knowledge Graph Service
 */
@Injectable()
export class KnowledgeGraphService {
  constructor(
    private readonly neo4jAdapter: Neo4jAdapter,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    private readonly componentService?: GraphComponentService,
  ) {}

  /**
   * Add a node to the knowledge graph
   */
  async addNode(
    label: string,
    type: string,
    layer: ICSLayer,
    properties: Record<string, any> = {},
  ): Promise<KGNode> {
    this.logger.info('Adding node to knowledge graph', { label, type, layer });

    const node = await this.neo4jAdapter.createNode(
      label,
      type,
      layer,
      properties,
    );

    // Create component for new node if component service is available
    if (this.componentService) {
      const category = properties?.category || type;
      await this.componentService.createComponent(node.id, category);
    }

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<KGNode | null> {
    return await this.neo4jAdapter.getNode(nodeId);
  }

  /**
   * Update a node
   */
  async updateNode(
    nodeId: string,
    updates: Partial<Omit<KGNode, 'id' | 'createdAt'>>,
  ): Promise<KGNode | null> {
    this.logger.info('Updating node', { nodeId });

    return await this.neo4jAdapter.updateNode(nodeId, updates);
  }

  /**
   * Remove a node from the knowledge graph
   */
  async removeNode(nodeId: string): Promise<boolean> {
    this.logger.info('Removing node from knowledge graph', { nodeId });

    return await this.neo4jAdapter.deleteNode(nodeId);
  }

  /**
   * Create a relationship between two nodes
   */
  async createRelationship(
    from: string,
    to: string,
    type: string,
    properties: Record<string, any> = {},
  ): Promise<KGEdge> {
    this.logger.info('Creating relationship', { from, to, type });

    return await this.neo4jAdapter.createEdge(from, to, type, properties);
  }

  /**
   * Remove a relationship
   */
  async removeRelationship(edgeId: string): Promise<boolean> {
    this.logger.info('Removing relationship', { edgeId });

    return await this.neo4jAdapter.deleteEdge(edgeId);
  }

  /**
   * Get all nodes in a specific ICS layer
   */
  async getNodesByLayer(layer: ICSLayer): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNodesByLayer(layer);
  }

  /**
   * Get all nodes of a specific type
   */
  async getNodesByType(type: string): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNodesByType(type);
  }

  /**
   * Get neighbors of a node
   */
  async getNeighbors(
    nodeId: string,
    direction: 'in' | 'out' | 'both' = 'both',
  ): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNeighbors(nodeId, direction);
  }

  /**
   * Query the knowledge graph with Cypher
   */
  async query(
    cypher: string,
    params: Record<string, any> = {},
  ): Promise<QueryResult> {
    this.logger.info('Executing knowledge graph query', { cypher });

    return await this.neo4jAdapter.query(cypher, params);
  }

  /**
   * Extract a subgraph around a node
   */
  async getSubgraph(nodeId: string, depth: number = 1): Promise<QueryResult> {
    this.logger.info('Extracting subgraph', { nodeId, depth });

    return await this.neo4jAdapter.getSubgraph(nodeId, depth);
  }

  /**
   * Search nodes by label or properties
   */
  async searchNodes(searchTerm: string): Promise<KGNode[]> {
    this.logger.info('Searching nodes', { searchTerm });

    return await this.neo4jAdapter.searchNodes(searchTerm);
  }

  /**
   * Get knowledge graph statistics
   */
  async getStats(): Promise<any> {
    return await this.neo4jAdapter.getStats();
  }

  /**
   * Build ICS hierarchy for a concept
   *
   * Creates nodes across all 6 ICS layers and links them hierarchically.
   */
  async buildICSHierarchy(
    concept: string,
    observations: string[],
    patterns: string[],
    models: string[],
    theories: string[],
    principles: string[],
    synthesis: string,
  ): Promise<{
    rootNode: KGNode;
    layerNodes: Record<ICSLayer, KGNode[]>;
  }> {
    this.logger.info('Building ICS hierarchy', { concept });

    const layerNodes: Record<ICSLayer, KGNode[]> = {
      [ICSLayer.L1_OBSERVATIONS]: [],
      [ICSLayer.L2_PATTERNS]: [],
      [ICSLayer.L3_MODELS]: [],
      [ICSLayer.L4_THEORIES]: [],
      [ICSLayer.L5_PRINCIPLES]: [],
      [ICSLayer.L6_SYNTHESIS]: [],
    };

    // Create synthesis node (root)
    const rootNode = await this.addNode(
      synthesis,
      'synthesis',
      ICSLayer.L6_SYNTHESIS,
      { concept },
    );
    layerNodes[ICSLayer.L6_SYNTHESIS].push(rootNode);

    // Create principle nodes and link to synthesis
    for (const principle of principles) {
      const node = await this.addNode(
        principle,
        'principle',
        ICSLayer.L5_PRINCIPLES,
        { concept },
      );
      layerNodes[ICSLayer.L5_PRINCIPLES].push(node);
      await this.createRelationship(node.id, rootNode.id, 'SUPPORTS', {});
    }

    // Create theory nodes and link to principles
    for (const theory of theories) {
      const node = await this.addNode(theory, 'theory', ICSLayer.L4_THEORIES, {
        concept,
      });
      layerNodes[ICSLayer.L4_THEORIES].push(node);

      // Link to relevant principles
      for (const principleNode of layerNodes[ICSLayer.L5_PRINCIPLES]) {
        await this.createRelationship(
          node.id,
          principleNode.id,
          'SUPPORTS',
          {},
        );
      }
    }

    // Create model nodes and link to theories
    for (const model of models) {
      const node = await this.addNode(model, 'model', ICSLayer.L3_MODELS, {
        concept,
      });
      layerNodes[ICSLayer.L3_MODELS].push(node);

      // Link to relevant theories
      for (const theoryNode of layerNodes[ICSLayer.L4_THEORIES]) {
        await this.createRelationship(node.id, theoryNode.id, 'SUPPORTS', {});
      }
    }

    // Create pattern nodes and link to models
    for (const pattern of patterns) {
      const node = await this.addNode(
        pattern,
        'pattern',
        ICSLayer.L2_PATTERNS,
        { concept },
      );
      layerNodes[ICSLayer.L2_PATTERNS].push(node);

      // Link to relevant models
      for (const modelNode of layerNodes[ICSLayer.L3_MODELS]) {
        await this.createRelationship(node.id, modelNode.id, 'SUPPORTS', {});
      }
    }

    // Create observation nodes and link to patterns
    for (const observation of observations) {
      const node = await this.addNode(
        observation,
        'observation',
        ICSLayer.L1_OBSERVATIONS,
        { concept },
      );
      layerNodes[ICSLayer.L1_OBSERVATIONS].push(node);

      // Link to relevant patterns
      for (const patternNode of layerNodes[ICSLayer.L2_PATTERNS]) {
        await this.createRelationship(node.id, patternNode.id, 'SUPPORTS', {});
      }
    }

    return {
      rootNode,
      layerNodes,
    };
  }

  /**
   * Traverse ICS hierarchy upward (from observations to synthesis)
   */
  async traverseUp(startNodeId: string): Promise<KGNode[]> {
    const path: KGNode[] = [];
    let currentNodeId: string | null = startNodeId;

    while (currentNodeId) {
      const node = await this.getNode(currentNodeId);
      if (!node) break;

      path.push(node);

      // Get parent (node that this node supports)
      const neighbors = await this.getNeighbors(currentNodeId, 'out');

      // Find next higher layer
      const nextNode = neighbors.find((n) => {
        const layerOrder = Object.values(ICSLayer);
        return layerOrder.indexOf(n.layer) > layerOrder.indexOf(node.layer);
      });

      currentNodeId = nextNode?.id || null;
    }

    return path;
  }

  /**
   * Traverse ICS hierarchy downward (from synthesis to observations)
   */
  async traverseDown(startNodeId: string): Promise<KGNode[]> {
    const path: KGNode[] = [];
    const queue: string[] = [startNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = await this.getNode(nodeId);
      if (!node) continue;

      path.push(node);

      // Get children (nodes that support this node)
      const neighbors = await this.getNeighbors(nodeId, 'in');

      // Add lower-layer nodes to queue
      for (const neighbor of neighbors) {
        const layerOrder = Object.values(ICSLayer);
        if (
          layerOrder.indexOf(neighbor.layer) < layerOrder.indexOf(node.layer)
        ) {
          queue.push(neighbor.id);
        }
      }
    }

    return path;
  }

  /**
   * Lock a node for exclusive access
   * @param nodeId Node to lock
   * @param actorId ID of agent/user acquiring the lock
   * @param reason Reason for locking
   * @returns true if lock acquired, false if already locked
   */
  async lockNode(
    nodeId: string,
    actorId: string,
    reason: string,
  ): Promise<boolean> {
    this.logger.info('Locking node', { nodeId, actorId, reason });
    return await this.neo4jAdapter.lockNode(nodeId, actorId, reason);
  }

  /**
   * Unlock a node
   * @param nodeId Node to unlock
   * @param actorId ID of agent/user releasing the lock (must match lock owner)
   * @returns true if unlocked, false if not locked or wrong actor
   */
  async unlockNode(nodeId: string, actorId: string): Promise<boolean> {
    this.logger.info('Unlocking node', { nodeId, actorId });
    return await this.neo4jAdapter.unlockNode(nodeId, actorId);
  }

  // ============================
  // Research Operations
  // ============================

  /**
   * Get all unresearched nodes, optionally filtered by layer
   */
  async getUnresearchedNodes(layer?: ICSLayer): Promise<KGNode[]> {
    return await this.neo4jAdapter.getUnresearchedNodes(layer);
  }

  /**
   * Lock a node for research
   */
  async lockNodeForResearch(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    this.logger.info('Locking node for research', { nodeId, agentId });
    return await this.neo4jAdapter.lockNodeForResearch(nodeId, agentId);
  }

  /**
   * Add research data to a node
   */
  async addResearchData(
    nodeId: string,
    researchData: ResearchData,
    sources: SourceCitation[],
    confidence: number,
  ): Promise<KGNode | null> {
    this.logger.info('Adding research data to node', { nodeId });
    return await this.neo4jAdapter.addResearchData(
      nodeId,
      researchData,
      sources,
      confidence,
    );
  }

  /**
   * Mark a node as dubious
   */
  async markNodeAsDubious(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    this.logger.warn('Marking node as dubious', { nodeId, agentId });
    return await this.neo4jAdapter.markNodeAsDubious(nodeId, agentId);
  }

  /**
   * Validate a node (increase confidence)
   */
  async validateNode(nodeId: string, agentId: string): Promise<KGNode | null> {
    this.logger.info('Validating node', { nodeId, agentId });
    return await this.neo4jAdapter.validateNode(nodeId, agentId);
  }

  // ============================
  // Enhanced Edge Operations
  // ============================

  /**
   * Get all edges connected to a node
   */
  async getConnectedEdges(nodeId: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getConnectedEdges(nodeId);
  }

  /**
   * Get outgoing edges from a node
   */
  async getOutgoingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getOutgoingEdges(nodeId, type);
  }

  /**
   * Get incoming edges to a node
   */
  async getIncomingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getIncomingEdges(nodeId, type);
  }

  /**
   * Find edge between two nodes
   */
  async findEdgeBetween(
    from: string,
    to: string,
    type?: string,
  ): Promise<KGEdge | null> {
    return await this.neo4jAdapter.findEdgeBetween(from, to, type);
  }

  // ============================
  // Enhanced Node Operations
  // ============================

  /**
   * Find or create a node with given label and type
   */
  async findOrCreateNode(
    label: string,
    type: string,
    layer: ICSLayer,
  ): Promise<KGNode> {
    return await this.neo4jAdapter.findOrCreateNode(label, type, layer);
  }

  /**
   * Connect two nodes with an edge (with optional properties)
   */
  async connectNodes(
    sourceId: string,
    targetId: string,
    edgeType: string,
    options?: {
      weight?: number;
      confidence?: number;
      equation?: string;
      rationale?: string;
    },
  ): Promise<KGEdge> {
    // Check if edge already exists
    const existing = await this.findEdgeBetween(sourceId, targetId, edgeType);
    if (existing) {
      // Update existing edge
      return await this.updateRelationship(existing.id, {
        weight: options?.weight ?? existing.weight,
        confidence: options?.confidence ?? existing.confidence,
        equation: options?.equation ?? existing.equation,
        rationale: options?.rationale ?? existing.rationale,
      });
    }

    // Create new edge
    return await this.createRelationship(
      sourceId,
      targetId,
      edgeType,
      {},
      options?.weight,
      options?.confidence,
      options?.equation,
      options?.rationale,
    );
  }

  /**
   * Update relationship properties
   */
  private async updateRelationship(
    edgeId: string,
    updates: Partial<KGEdge>,
  ): Promise<KGEdge> {
    const edge = await this.neo4jAdapter.getEdge(edgeId);
    if (!edge) {
      throw new Error(`Edge ${edgeId} not found`);
    }

    const updated: KGEdge = { ...edge, ...updates };
    // In production, update in Neo4j
    return updated;
  }

  /**
   * Create relationship with enhanced properties
   */
  private async createRelationship(
    from: string,
    to: string,
    type: string,
    properties: Record<string, any> = {},
    weight?: number,
    confidence?: number,
    equation?: string,
    rationale?: string,
  ): Promise<KGEdge> {
    const edge = await this.neo4jAdapter.createEdge(
      from,
      to,
      type,
      properties,
      weight,
      confidence,
      equation,
      rationale,
    );

    // Handle component merging if component service is available
    if (this.componentService) {
      const [sourceCompId, targetCompId] = await Promise.all([
        this.componentService.getComponentId(from),
        this.componentService.getComponentId(to),
      ]);

      if (sourceCompId && targetCompId && sourceCompId !== targetCompId) {
        // Merge components
        await this.componentService.mergeComponents(sourceCompId, targetCompId);
      } else if (sourceCompId) {
        // Increment edge count for component
        await this.componentService.incrementEdgeCount(sourceCompId);
      } else if (targetCompId) {
        await this.componentService.incrementEdgeCount(targetCompId);
      }
    }

    return edge;
  }

  /**
   * Get the full graph structure (nodes and edges)
   */
  async getGraphStructure(): Promise<{
    nodes: KGNode[];
    edges: KGEdge[];
  }> {
    const allNodes = await this.getAllNodes();
    const allEdges = await this.getAllEdges();
    return { nodes: allNodes, edges: allEdges };
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByCategory: Record<string, number>;
    nodesByLayer: Record<number, number>;
    nodesByStatus: Record<string, number>;
  }> {
    const stats = await this.neo4jAdapter.getStats();
    const allNodes = await this.getAllNodes();

    const nodesByCategory: Record<string, number> = {};
    const nodesByStatus: Record<string, number> = {};

    for (const node of allNodes) {
      const category = (node.properties?.category as string) || 'Unknown';
      nodesByCategory[category] = (nodesByCategory[category] || 0) + 1;

      const status = node.researchStatus || 'unknown';
      nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
    }

    return {
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      nodesByCategory,
      nodesByLayer: stats.nodesByLayer as any,
      nodesByStatus,
    };
  }

  /**
   * Get all nodes
   */
  private async getAllNodes(): Promise<KGNode[]> {
    // Get all nodes by querying all layers
    const allNodes: KGNode[] = [];
    for (const layer of Object.values(ICSLayer)) {
      const nodes = await this.getNodesByLayer(layer);
      allNodes.push(...nodes);
    }
    return allNodes;
  }

  /**
   * Get all edges
   */
  private async getAllEdges(): Promise<KGEdge[]> {
    // This would require a method in the adapter to get all edges
    // For now, return empty array - in production, implement getAllEdges in adapter
    return [];
  }
}
