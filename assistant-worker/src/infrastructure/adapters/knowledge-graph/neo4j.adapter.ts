/**
 * Neo4j Knowledge Graph Adapter
 *
 * Provides interface to Neo4j graph database for storing and querying knowledge.
 * Supports ICS (Integrated Concept Synthesis) methodology with 6 layers.
 */

import { Injectable } from '@nestjs/common';

/**
 * ICS Layer enumeration (L1-L6)
 */
export enum ICSLayer {
  L1_OBSERVATIONS = 'L1_OBSERVATIONS', // Raw data, observations
  L2_PATTERNS = 'L2_PATTERNS', // Patterns, correlations
  L3_MODELS = 'L3_MODELS', // Conceptual models
  L4_THEORIES = 'L4_THEORIES', // Theories, frameworks
  L5_PRINCIPLES = 'L5_PRINCIPLES', // Universal principles
  L6_SYNTHESIS = 'L6_SYNTHESIS', // Integrated synthesis
}

/**
 * Research status for knowledge graph nodes
 */
export enum ResearchStatus {
  UNRESEARCHED = 'unresearched',
  IN_PROGRESS = 'in_progress',
  RESEARCHED = 'researched',
  NEEDS_UPDATE = 'needs_update',
  DUBIOUS = 'dubious',
}

/**
 * Source citation for node information
 */
export interface SourceCitation {
  url?: string;
  title?: string;
  author?: string;
  retrievedAt: Date;
  sourceType: 'web' | 'academic' | 'document' | 'user' | 'llm';
}

/**
 * Research data gathered during research phase
 */
export interface ResearchData {
  summary?: string;
  keyPoints?: string[];
  examples?: string[];
  relatedConcepts?: string[];
  equations?: string[];
}

/**
 * Node lock information
 */
export interface NodeLock {
  lockedBy: string; // Agent ID or user ID
  lockedAt: Date;
  reason: string;
}

/**
 * Knowledge Graph Node
 */
export interface KGNode {
  id: string;
  label: string;
  type: string;
  layer: ICSLayer;
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lock?: NodeLock;
  researchStatus?: ResearchStatus;
  confidence?: number;
  validationCount?: number;
  validatedBy?: string[];
  sources?: SourceCitation[];
  researchData?: ResearchData;
  graphComponentId?: string;
  explorationStatus?: string; // Tracks how explored/researched the node is (e.g., "unexplored", "exploring", "explored", "fully_researched")
  domain?: string; // Domain name for L1 observation nodes
  domainColor?: string; // Color associated with the domain
}

/**
 * Knowledge Graph Edge (Relationship)
 */
export interface KGEdge {
  id: string;
  from: string; // Source node ID
  to: string; // Target node ID
  type: string; // Relationship type (one-word label: "inverse", "equation", "derives", "contains", etc.)
  properties: Record<string, any>;
  weight?: number;
  confidence?: number;
  equation?: string;
  rationale?: string;
  bidirectional?: boolean; // If true, edge is bidirectional (source ↔ target)
  createdAt: Date;
}

/**
 * Graph Query Result
 */
export interface QueryResult {
  nodes: KGNode[];
  edges: KGEdge[];
  metadata?: Record<string, any>;
}

/**
 * Neo4j Adapter for Knowledge Graph
 *
 * Note: This is a mock implementation. In production, integrate with actual Neo4j driver.
 */
@Injectable()
export class Neo4jAdapter {
  // Mock in-memory storage (replace with actual Neo4j connection)
  private nodes: Map<string, KGNode> = new Map();
  private edges: Map<string, KGEdge> = new Map();

  constructor() {
    // @Inject('NEO4J_DRIVER') private readonly driver: any,
    // Initialize Neo4j connection here
    // this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  /**
   * Create a new node
   */
  async createNode(
    label: string,
    type: string,
    layer: ICSLayer,
    properties: Record<string, any> = {},
  ): Promise<KGNode> {
    const node: KGNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label,
      type,
      layer,
      properties,
      createdAt: new Date(),
      updatedAt: new Date(),
      researchStatus: ResearchStatus.UNRESEARCHED,
      confidence: 0.5,
      validationCount: 0,
      validatedBy: [],
      sources: [],
      explorationStatus: 'unexplored',
    };

    // Mock storage (replace with actual Neo4j operation)
    this.nodes.set(node.id, node);

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'CREATE (n:Node {id: $id, label: $label, type: $type, layer: $layer, properties: $properties, createdAt: $createdAt, updatedAt: $updatedAt}) RETURN n',
    //     { id: node.id, label, type, layer, properties: JSON.stringify(properties), createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString() }
    //   );
    //   return result.records[0].get('n').properties;
    // } finally {
    //   await session.close();
    // }

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<KGNode | null> {
    // Mock retrieval (replace with actual Neo4j operation)
    return this.nodes.get(nodeId) || null;

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node {id: $id}) RETURN n',
    //     { id: nodeId }
    //   );
    //   if (result.records.length === 0) return null;
    //   return result.records[0].get('n').properties;
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Update a node
   */
  async updateNode(
    nodeId: string,
    updates: Partial<Omit<KGNode, 'id' | 'createdAt'>>,
  ): Promise<KGNode | null> {
    const node = this.nodes.get(nodeId);

    if (!node) {
      return null;
    }

    // Apply updates
    Object.assign(node, updates, {
      updatedAt: new Date(),
    });

    this.nodes.set(nodeId, node);

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node {id: $id}) SET n += $updates, n.updatedAt = $updatedAt RETURN n',
    //     { id: nodeId, updates, updatedAt: new Date().toISOString() }
    //   );
    //   return result.records[0].get('n').properties;
    // } finally {
    //   await session.close();
    // }

    return node;
  }

  /**
   * Delete a node
   */
  async deleteNode(nodeId: string): Promise<boolean> {
    const deleted = this.nodes.delete(nodeId);

    // Also delete edges connected to this node
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.edges.delete(edgeId);
      }
    }

    // In production:
    // const session = this.driver.session();
    // try {
    //   await session.run(
    //     'MATCH (n:Node {id: $id}) DETACH DELETE n',
    //     { id: nodeId }
    //   );
    //   return true;
    // } finally {
    //   await session.close();
    // }

    return deleted;
  }

  /**
   * Create an edge (relationship) between two nodes
   */
  async createEdge(
    from: string,
    to: string,
    type: string,
    properties: Record<string, any> = {},
    weight?: number,
    confidence?: number,
    equation?: string,
    rationale?: string,
    bidirectional?: boolean,
  ): Promise<KGEdge> {
    // Validate relationship type is one word (for labels like "inverse", "equation", "derives", "contains")
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(type)) {
      throw new Error(
        `Relationship type must be a single word (alphanumeric and underscores only): "${type}"`,
      );
    }

    // Verify nodes exist
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error('Source or target node does not exist');
    }

    const edge: KGEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type,
      properties,
      weight: weight ?? 1.0,
      confidence: confidence ?? 0.7,
      equation,
      rationale,
      bidirectional: bidirectional ?? false,
      createdAt: new Date(),
    };

    this.edges.set(edge.id, edge);

    // If bidirectional, create reverse edge
    if (bidirectional) {
      const reverseEdge: KGEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        from: to,
        to: from,
        type,
        properties: { ...properties },
        weight: weight ?? 1.0,
        confidence: confidence ?? 0.7,
        equation,
        rationale,
        bidirectional: true,
        createdAt: new Date(),
      };
      this.edges.set(reverseEdge.id, reverseEdge);
    }

    // In production:
    // const session = this.driver.session();
    // try {
    //   if (bidirectional) {
    //     // Create bidirectional relationship in Neo4j
    //     const result = await session.run(
    //       'MATCH (a:Node {id: $from}), (b:Node {id: $to}) CREATE (a)-[r:RELATIONSHIP {id: $id, type: $type, properties: $properties, bidirectional: true, createdAt: $createdAt}]-(b) RETURN r',
    //       { from, to, id: edge.id, type, properties: JSON.stringify(properties), createdAt: edge.createdAt.toISOString() }
    //     );
    //   } else {
    //     // Create directed relationship
    //     const result = await session.run(
    //       'MATCH (a:Node {id: $from}), (b:Node {id: $to}) CREATE (a)-[r:RELATIONSHIP {id: $id, type: $type, properties: $properties, createdAt: $createdAt}]->(b) RETURN r',
    //       { from, to, id: edge.id, type, properties: JSON.stringify(properties), createdAt: edge.createdAt.toISOString() }
    //     );
    //   }
    //   return result.records[0].get('r').properties;
    // } finally {
    //   await session.close();
    // }

    return edge;
  }

  /**
   * Get an edge by ID
   */
  async getEdge(edgeId: string): Promise<KGEdge | null> {
    return this.edges.get(edgeId) || null;
  }

  /**
   * Update an edge
   */
  async updateEdge(
    edgeId: string,
    updates: Partial<Omit<KGEdge, 'id' | 'createdAt'>>,
  ): Promise<KGEdge | null> {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return null;
    }

    // Validate relationship type if being updated
    if (updates.type && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(updates.type)) {
      throw new Error(
        `Relationship type must be a single word (alphanumeric and underscores only): "${updates.type}"`,
      );
    }

    const wasBidirectional = edge.bidirectional ?? false;
    const willBeBidirectional = updates.bidirectional ?? wasBidirectional;

    // Handle bidirectional flag changes
    if (wasBidirectional !== willBeBidirectional) {
      if (willBeBidirectional) {
        // Changing from unidirectional to bidirectional: create reverse edge
        const reverseEdge: KGEdge = {
          id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: edge.to,
          to: edge.from,
          type: updates.type ?? edge.type,
          properties: { ...(updates.properties ?? edge.properties) },
          weight: updates.weight ?? edge.weight,
          confidence: updates.confidence ?? edge.confidence,
          equation: updates.equation ?? edge.equation,
          rationale: updates.rationale ?? edge.rationale,
          bidirectional: true,
          createdAt: edge.createdAt,
        };
        this.edges.set(reverseEdge.id, reverseEdge);
      } else {
        // Changing from bidirectional to unidirectional: delete reverse edge
        // Find and delete the reverse edge
        for (const [id, e] of this.edges.entries()) {
          if (
            e.from === edge.to &&
            e.to === edge.from &&
            e.type === (updates.type ?? edge.type) &&
            id !== edgeId
          ) {
            this.edges.delete(id);
            break;
          }
        }
      }
    }

    // Apply updates
    Object.assign(edge, updates);

    this.edges.set(edgeId, edge);

    return edge;
  }

  /**
   * Get all nodes with pagination and optional layer filter
   */
  async getAllNodes(
    limit?: number,
    offset?: number,
    layers?: ICSLayer[],
  ): Promise<{ nodes: KGNode[]; total: number }> {
    let allNodes = Array.from(this.nodes.values());

    // Filter by layers if specified
    if (layers && layers.length > 0) {
      allNodes = allNodes.filter((node) => layers.includes(node.layer));
    }

    const total = allNodes.length;

    // Apply pagination
    if (offset !== undefined) {
      allNodes = allNodes.slice(offset);
    }
    if (limit !== undefined) {
      allNodes = allNodes.slice(0, limit);
    }

    return { nodes: allNodes, total };
  }

  /**
   * Get all edges with pagination
   */
  async getAllEdges(
    limit?: number,
    offset?: number,
  ): Promise<{ edges: KGEdge[]; total: number }> {
    let allEdges = Array.from(this.edges.values());
    const total = allEdges.length;

    // Apply pagination
    if (offset !== undefined) {
      allEdges = allEdges.slice(offset);
    }
    if (limit !== undefined) {
      allEdges = allEdges.slice(0, limit);
    }

    return { edges: allEdges, total };
  }

  /**
   * Delete an edge
   */
  async deleteEdge(edgeId: string): Promise<boolean> {
    return this.edges.delete(edgeId);

    // In production:
    // const session = this.driver.session();
    // try {
    //   await session.run(
    //     'MATCH ()-[r:RELATIONSHIP {id: $id}]-() DELETE r',
    //     { id: edgeId }
    //   );
    //   return true;
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Get all nodes by layer
   */
  async getNodesByLayer(layer: ICSLayer): Promise<KGNode[]> {
    return Array.from(this.nodes.values()).filter(
      (node) => node.layer === layer,
    );

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node {layer: $layer}) RETURN n',
    //     { layer }
    //   );
    //   return result.records.map(record => record.get('n').properties);
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Get all nodes by type
   */
  async getNodesByType(type: string): Promise<KGNode[]> {
    return Array.from(this.nodes.values()).filter((node) => node.type === type);
  }

  /**
   * Get neighbors of a node
   */
  async getNeighbors(
    nodeId: string,
    direction: 'in' | 'out' | 'both' = 'both',
  ): Promise<KGNode[]> {
    const neighborIds = new Set<string>();

    for (const edge of this.edges.values()) {
      if (direction === 'out' || direction === 'both') {
        if (edge.from === nodeId) {
          neighborIds.add(edge.to);
        }
      }
      if (direction === 'in' || direction === 'both') {
        if (edge.to === nodeId) {
          neighborIds.add(edge.from);
        }
      }
    }

    const neighbors: KGNode[] = [];
    for (const id of neighborIds) {
      const node = this.nodes.get(id);
      if (node) {
        neighbors.push(node);
      }
    }

    return neighbors;

    // In production:
    // const session = this.driver.session();
    // try {
    //   let query = '';
    //   if (direction === 'out') {
    //     query = 'MATCH (n:Node {id: $id})-[]->(m:Node) RETURN m';
    //   } else if (direction === 'in') {
    //     query = 'MATCH (n:Node {id: $id})<-[]-(m:Node) RETURN m';
    //   } else {
    //     query = 'MATCH (n:Node {id: $id})-[]-(m:Node) RETURN m';
    //   }
    //   const result = await session.run(query, { id: nodeId });
    //   return result.records.map(record => record.get('m').properties);
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Execute a custom Cypher query
   */
  async query(
    cypher: string,
    params: Record<string, any> = {},
  ): Promise<QueryResult> {
    // Mock query execution (in production, execute actual Cypher)
    return {
      nodes: [],
      edges: [],
      metadata: { query: cypher, params },
    };

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(cypher, params);
    //   // Parse result into nodes and edges
    //   return parseQueryResult(result);
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Get subgraph around a node
   */
  async getSubgraph(nodeId: string, depth: number = 1): Promise<QueryResult> {
    const nodes: KGNode[] = [];
    const edges: KGEdge[] = [];
    const visited = new Set<string>();

    // BFS to collect nodes and edges up to specified depth
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: nodeId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      if (visited.has(id) || currentDepth > depth) {
        continue;
      }

      visited.add(id);

      const node = this.nodes.get(id);
      if (node) {
        nodes.push(node);
      }

      if (currentDepth < depth) {
        // Add neighbors to queue
        for (const edge of this.edges.values()) {
          if (edge.from === id) {
            edges.push(edge);
            queue.push({ id: edge.to, currentDepth: currentDepth + 1 });
          } else if (edge.to === id) {
            edges.push(edge);
            queue.push({ id: edge.from, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return { nodes, edges };

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH path = (n:Node {id: $id})-[*0..$depth]-(m:Node) RETURN nodes(path), relationships(path)',
    //     { id: nodeId, depth }
    //   );
    //   // Parse result
    //   return parseSubgraphResult(result);
    // } finally {
    //   await session.close();
    // }
  }

  /**
   * Search nodes by label or properties
   */
  async searchNodes(searchTerm: string): Promise<KGNode[]> {
    const lowerSearch = searchTerm.toLowerCase();

    return Array.from(this.nodes.values()).filter((node) => {
      // Search in label
      if (node.label.toLowerCase().includes(lowerSearch)) {
        return true;
      }

      // Search in properties
      return Object.values(node.properties).some((value) =>
        String(value).toLowerCase().includes(lowerSearch),
      );
    });

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node) WHERE n.label CONTAINS $search OR any(prop in keys(n) WHERE toString(n[prop]) CONTAINS $search) RETURN n',
    //     { search: searchTerm }
    //   );
    //   return result.records.map(record => record.get('n').properties);
    // } finally {
    //   await session.close();
    // }
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
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // Check if already locked by someone else
    if (node.lock && node.lock.lockedBy !== actorId) {
      return false;
    }

    // Lock the node
    node.lock = {
      lockedBy: actorId,
      lockedAt: new Date(),
      reason,
    };
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node {id: $id}) WHERE NOT EXISTS(n.lock) OR n.lock.lockedBy = $actorId SET n.lock = {lockedBy: $actorId, lockedAt: $lockedAt, reason: $reason}, n.updatedAt = $updatedAt RETURN n',
    //     { id: nodeId, actorId, lockedAt: new Date().toISOString(), reason, updatedAt: new Date().toISOString() }
    //   );
    //   return result.records.length > 0;
    // } finally {
    //   await session.close();
    // }

    return true;
  }

  /**
   * Unlock a node
   * @param nodeId Node to unlock
   * @param actorId ID of agent/user releasing the lock (must match lock owner)
   * @returns true if unlocked, false if not locked or wrong actor
   */
  async unlockNode(nodeId: string, actorId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node || !node.lock) {
      return false;
    }

    // Check if actor owns the lock
    if (node.lock.lockedBy !== actorId) {
      return false;
    }

    // Unlock the node
    delete node.lock;
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);

    // In production:
    // const session = this.driver.session();
    // try {
    //   const result = await session.run(
    //     'MATCH (n:Node {id: $id}) WHERE n.lock.lockedBy = $actorId REMOVE n.lock SET n.updatedAt = $updatedAt RETURN n',
    //     { id: nodeId, actorId, updatedAt: new Date().toISOString() }
    //   );
    //   return result.records.length > 0;
    // } finally {
    //   await session.close();
    // }

    return true;
  }

  /**
   * Get unresearched nodes, optionally filtered by layer
   */
  async getUnresearchedNodes(layer?: ICSLayer): Promise<KGNode[]> {
    return Array.from(this.nodes.values()).filter((node) => {
      if (
        node.researchStatus !== ResearchStatus.UNRESEARCHED &&
        node.researchStatus !== undefined
      ) {
        return false;
      }
      if (layer && node.layer !== layer) {
        return false;
      }
      return true;
    });
  }

  /**
   * Lock a node for research
   */
  async lockNodeForResearch(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    const locked = await this.lockNode(nodeId, agentId, 'research_in_progress');
    if (!locked) {
      return null;
    }

    node.researchStatus = ResearchStatus.IN_PROGRESS;
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);
    return node;
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
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    node.researchData = researchData;
    node.sources = [...(node.sources || []), ...sources];
    node.confidence = Math.max(node.confidence || 0.5, confidence);
    node.researchStatus = ResearchStatus.RESEARCHED;
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Mark a node as dubious
   */
  async markNodeAsDubious(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    node.researchStatus = ResearchStatus.DUBIOUS;
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Validate a node (increase confidence)
   */
  async validateNode(nodeId: string, agentId: string): Promise<KGNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    node.validationCount = (node.validationCount || 0) + 1;
    node.validatedBy = [...(node.validatedBy || []), agentId];
    node.confidence = Math.min(1.0, (node.confidence || 0.5) + 0.1);
    node.updatedAt = new Date();
    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Get connected edges for a node
   */
  async getConnectedEdges(nodeId: string): Promise<KGEdge[]> {
    return Array.from(this.edges.values()).filter(
      (edge) => edge.from === nodeId || edge.to === nodeId,
    );
  }

  /**
   * Get outgoing edges from a node
   */
  async getOutgoingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return Array.from(this.edges.values()).filter((edge) => {
      if (edge.from !== nodeId) {
        return false;
      }
      if (type && edge.type !== type) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get incoming edges to a node
   */
  async getIncomingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return Array.from(this.edges.values()).filter((edge) => {
      if (edge.to !== nodeId) {
        return false;
      }
      if (type && edge.type !== type) {
        return false;
      }
      return true;
    });
  }

  /**
   * Find edge between two nodes
   */
  async findEdgeBetween(
    from: string,
    to: string,
    type?: string,
  ): Promise<KGEdge | null> {
    for (const edge of this.edges.values()) {
      if (edge.from === from && edge.to === to) {
        if (!type || edge.type === type) {
          return edge;
        }
      }
    }
    return null;
  }

  /**
   * Find or create a node
   */
  async findOrCreateNode(
    label: string,
    type: string,
    layer: ICSLayer,
    properties: Record<string, any> = {},
  ): Promise<KGNode> {
    // Try to find existing node
    const existing = Array.from(this.nodes.values()).find(
      (n) => n.label === label && n.type === type && n.layer === layer,
    );
    if (existing) {
      return existing;
    }

    // Create new node
    return await this.createNode(label, type, layer, properties);
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByLayer: Record<ICSLayer, number>;
    nodesByType: Record<string, number>;
  }> {
    const nodesByLayer: Record<ICSLayer, number> = {
      [ICSLayer.L1_OBSERVATIONS]: 0,
      [ICSLayer.L2_PATTERNS]: 0,
      [ICSLayer.L3_MODELS]: 0,
      [ICSLayer.L4_THEORIES]: 0,
      [ICSLayer.L5_PRINCIPLES]: 0,
      [ICSLayer.L6_SYNTHESIS]: 0,
    };

    const nodesByType: Record<string, number> = {};

    for (const node of this.nodes.values()) {
      nodesByLayer[node.layer]++;
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByLayer,
      nodesByType,
    };
  }
}
