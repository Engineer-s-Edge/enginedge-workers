/**
 * Knowledge Graph Controller
 *
 * REST API endpoints for knowledge graph management.
 * Supports ICS (Integrated Concept Synthesis) methodology.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { KnowledgeGraphService } from '@application/services/knowledge-graph.service';
// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
import { ICSLayer } from '@infrastructure/adapters/knowledge-graph/neo4j.adapter';

/**
 * Knowledge Graph Controller
 */
@Controller('knowledge-graph')
export class KnowledgeGraphController {
  constructor(
    private readonly knowledgeGraphService: KnowledgeGraphService,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /knowledge-graph/nodes - Create a new node
   */
  @Post('nodes')
  @HttpCode(HttpStatus.CREATED)
  async createNode(
    @Body()
    body: {
      label: string;
      type: string;
      layer: ICSLayer;
      properties?: Record<string, any>;
    },
  ) {
    this.logger.info('Creating knowledge graph node', {
      label: body.label,
      type: body.type,
    });

    const node = await this.knowledgeGraphService.addNode(
      body.label,
      body.type,
      body.layer,
      body.properties || {},
    );

    return {
      success: true,
      node,
    };
  }

  /**
   * GET /knowledge-graph/nodes/:id - Get a node by ID
   */
  @Get('nodes/:id')
  async getNode(@Param('id') nodeId: string) {
    this.logger.info('Getting knowledge graph node', { nodeId });

    const node = await this.knowledgeGraphService.getNode(nodeId);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    return {
      node,
    };
  }

  /**
   * DELETE /knowledge-graph/nodes/:id - Delete a node
   */
  @Delete('nodes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNode(@Param('id') nodeId: string) {
    this.logger.info('Deleting knowledge graph node', { nodeId });

    const deleted = await this.knowledgeGraphService.removeNode(nodeId);

    return {
      success: deleted,
      message: deleted ? 'Node deleted' : 'Node not found',
    };
  }

  /**
   * POST /knowledge-graph/edges - Create a relationship
   */
  @Post('edges')
  @HttpCode(HttpStatus.CREATED)
  async createEdge(
    @Body()
    body: {
      from: string;
      to: string;
      type: string;
      properties?: Record<string, any>;
    },
  ) {
    this.logger.info('Creating knowledge graph edge', {
      from: body.from,
      to: body.to,
      type: body.type,
    });

    const edge = await this.knowledgeGraphService.createRelationship(
      body.from,
      body.to,
      body.type,
      body.properties || {},
    );

    return {
      success: true,
      edge,
    };
  }

  /**
   * DELETE /knowledge-graph/edges/:id - Delete a relationship
   */
  @Delete('edges/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEdge(@Param('id') edgeId: string) {
    this.logger.info('Deleting knowledge graph edge', { edgeId });

    const deleted = await this.knowledgeGraphService.removeRelationship(edgeId);

    return {
      success: deleted,
      message: deleted ? 'Edge deleted' : 'Edge not found',
    };
  }

  /**
   * GET /knowledge-graph/query - Execute a Cypher query
   */
  @Get('query')
  async executeQuery(
    @Query('cypher') cypher: string,
    @Query('params') params?: string,
  ) {
    this.logger.info('Executing knowledge graph query', { cypher });

    const parsedParams = params ? JSON.parse(params) : {};
    const result = await this.knowledgeGraphService.query(cypher, parsedParams);

    return {
      result,
    };
  }

  /**
   * GET /knowledge-graph/nodes/layer/:layer - Get nodes by ICS layer
   */
  @Get('nodes/layer/:layer')
  async getNodesByLayer(@Param('layer') layer: ICSLayer) {
    this.logger.info('Getting nodes by layer', { layer });

    const nodes = await this.knowledgeGraphService.getNodesByLayer(layer);

    return {
      layer,
      nodes,
      total: nodes.length,
    };
  }

  /**
   * GET /knowledge-graph/nodes/type/:type - Get nodes by type
   */
  @Get('nodes/type/:type')
  async getNodesByType(@Param('type') type: string) {
    this.logger.info('Getting nodes by type', { type });

    const nodes = await this.knowledgeGraphService.getNodesByType(type);

    return {
      type,
      nodes,
      total: nodes.length,
    };
  }

  /**
   * GET /knowledge-graph/nodes/:id/neighbors - Get node neighbors
   */
  @Get('nodes/:id/neighbors')
  async getNeighbors(
    @Param('id') nodeId: string,
    @Query('direction') direction?: 'in' | 'out' | 'both',
  ) {
    this.logger.info('Getting node neighbors', { nodeId, direction });

    const neighbors = await this.knowledgeGraphService.getNeighbors(
      nodeId,
      direction || 'both',
    );

    return {
      nodeId,
      neighbors,
      total: neighbors.length,
    };
  }

  /**
   * GET /knowledge-graph/nodes/:id/subgraph - Get subgraph around a node
   */
  @Get('nodes/:id/subgraph')
  async getSubgraph(
    @Param('id') nodeId: string,
    @Query('depth') depth?: number,
  ) {
    this.logger.info('Getting subgraph', { nodeId, depth });

    const subgraph = await this.knowledgeGraphService.getSubgraph(
      nodeId,
      depth ? parseInt(depth.toString()) : 1,
    );

    return {
      nodeId,
      depth: depth || 1,
      subgraph,
    };
  }

  /**
   * POST /knowledge-graph/search - Search nodes
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchNodes(@Body() body: { searchTerm: string }) {
    this.logger.info('Searching nodes', { searchTerm: body.searchTerm });

    const nodes = await this.knowledgeGraphService.searchNodes(body.searchTerm);

    return {
      searchTerm: body.searchTerm,
      nodes,
      total: nodes.length,
    };
  }

  /**
   * GET /knowledge-graph/stats - Get graph statistics
   */
  @Get('stats')
  async getStats() {
    this.logger.info('Getting knowledge graph statistics');

    const stats = await this.knowledgeGraphService.getStats();

    return {
      stats,
    };
  }

  /**
   * POST /knowledge-graph/ics/build - Build ICS hierarchy
   */
  @Post('ics/build')
  @HttpCode(HttpStatus.CREATED)
  async buildICSHierarchy(
    @Body()
    body: {
      concept: string;
      observations: string[];
      patterns: string[];
      models: string[];
      theories: string[];
      principles: string[];
      synthesis: string;
    },
  ) {
    this.logger.info('Building ICS hierarchy', { concept: body.concept });

    const result = await this.knowledgeGraphService.buildICSHierarchy(
      body.concept,
      body.observations,
      body.patterns,
      body.models,
      body.theories,
      body.principles,
      body.synthesis,
    );

    return {
      success: true,
      concept: body.concept,
      rootNode: result.rootNode,
      layerCounts: {
        observations: result.layerNodes[ICSLayer.L1_OBSERVATIONS].length,
        patterns: result.layerNodes[ICSLayer.L2_PATTERNS].length,
        models: result.layerNodes[ICSLayer.L3_MODELS].length,
        theories: result.layerNodes[ICSLayer.L4_THEORIES].length,
        principles: result.layerNodes[ICSLayer.L5_PRINCIPLES].length,
        synthesis: result.layerNodes[ICSLayer.L6_SYNTHESIS].length,
      },
    };
  }

  /**
   * GET /knowledge-graph/ics/traverse-up/:nodeId - Traverse ICS hierarchy upward
   */
  @Get('ics/traverse-up/:nodeId')
  async traverseUp(@Param('nodeId') nodeId: string) {
    this.logger.info('Traversing ICS hierarchy upward', { nodeId });

    const path = await this.knowledgeGraphService.traverseUp(nodeId);

    return {
      nodeId,
      path,
      layers: path.map((node) => node.layer),
    };
  }

  /**
   * GET /knowledge-graph/ics/traverse-down/:nodeId - Traverse ICS hierarchy downward
   */
  @Get('ics/traverse-down/:nodeId')
  async traverseDown(@Param('nodeId') nodeId: string) {
    this.logger.info('Traversing ICS hierarchy downward', { nodeId });

    const path = await this.knowledgeGraphService.traverseDown(nodeId);

    return {
      nodeId,
      path,
      layers: path.map((node) => node.layer),
    };
  }

  /**
   * GET /knowledge-graph/nodes - Get all nodes with pagination
   */
  @Get('nodes')
  async getAllNodes(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('layers') layers?: string,
  ) {
    this.logger.info('Getting all nodes', { limit, offset, layers });

    // Parse layers query parameter (comma-separated layer numbers or names)
    let layerFilter: ICSLayer[] | undefined;
    if (layers) {
      const layerNumbers = layers.split(',').map((l) => l.trim());
      layerFilter = layerNumbers
        .map((l) => {
          // Support both numeric (1,2,3) and named (L1_OBSERVATIONS) formats
          if (l.match(/^\d+$/)) {
            const num = parseInt(l);
            const layerMap: Record<number, ICSLayer> = {
              1: ICSLayer.L1_OBSERVATIONS,
              2: ICSLayer.L2_PATTERNS,
              3: ICSLayer.L3_MODELS,
              4: ICSLayer.L4_THEORIES,
              5: ICSLayer.L5_PRINCIPLES,
              6: ICSLayer.L6_SYNTHESIS,
            };
            return layerMap[num];
          }
          return l as ICSLayer;
        })
        .filter((l): l is ICSLayer => !!l);
    }

    const result = await this.knowledgeGraphService.getAllNodes(
      limit ? parseInt(limit.toString()) : undefined,
      offset ? parseInt(offset.toString()) : undefined,
      layerFilter,
    );

    return {
      success: true,
      nodes: result.nodes,
      total: result.total,
      limit: limit ? parseInt(limit.toString()) : undefined,
      offset: offset ? parseInt(offset.toString()) : undefined,
    };
  }

  /**
   * GET /knowledge-graph/edges - Get all edges with pagination
   */
  @Get('edges')
  async getAllEdges(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    this.logger.info('Getting all edges', { limit, offset });

    const result = await this.knowledgeGraphService.getAllEdges(
      limit ? parseInt(limit.toString()) : undefined,
      offset ? parseInt(offset.toString()) : undefined,
    );

    return {
      success: true,
      edges: result.edges,
      total: result.total,
      limit: limit ? parseInt(limit.toString()) : undefined,
      offset: offset ? parseInt(offset.toString()) : undefined,
    };
  }

  /**
   * GET /knowledge-graph/edges/:id - Get edge by ID
   */
  @Get('edges/:id')
  async getEdge(@Param('id') edgeId: string) {
    this.logger.info('Getting edge', { edgeId });

    const edge = await this.knowledgeGraphService.getEdge(edgeId);

    if (!edge) {
      throw new Error(`Edge ${edgeId} not found`);
    }

    return {
      success: true,
      edge,
    };
  }

  /**
   * PATCH /knowledge-graph/nodes/:id - Update node
   */
  @Patch('nodes/:id')
  async updateNode(
    @Param('id') nodeId: string,
    @Body()
    body: {
      label?: string;
      layer?: ICSLayer;
      properties?: Record<string, any>;
      explorationStatus?: string;
      domain?: string;
      domainColor?: string;
    },
  ) {
    this.logger.info('Updating node', { nodeId });

    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.layer !== undefined) updates.layer = body.layer;
    if (body.properties !== undefined) updates.properties = body.properties;
    if (body.explorationStatus !== undefined)
      updates.explorationStatus = body.explorationStatus;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.domainColor !== undefined) updates.domainColor = body.domainColor;

    const node = await this.knowledgeGraphService.updateNode(nodeId, updates);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    return {
      success: true,
      node,
    };
  }

  /**
   * PATCH /knowledge-graph/edges/:id - Update edge
   */
  @Patch('edges/:id')
  async updateEdge(
    @Param('id') edgeId: string,
    @Body()
    body: {
      label?: string;
      type?: string;
      source?: string;
      target?: string;
      properties?: Record<string, any>;
      bidirectional?: boolean;
    },
  ) {
    this.logger.info('Updating edge', { edgeId });

    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.type !== undefined) updates.type = body.type;
    if (body.source !== undefined) updates.from = body.source;
    if (body.target !== undefined) updates.to = body.target;
    if (body.properties !== undefined) updates.properties = body.properties;
    if (body.bidirectional !== undefined)
      updates.bidirectional = body.bidirectional;

    const edge = await this.knowledgeGraphService.updateEdge(edgeId, updates);

    if (!edge) {
      throw new Error(`Edge ${edgeId} not found`);
    }

    return {
      success: true,
      edge,
    };
  }

  /**
   * POST /knowledge-graph/nodes/bulk-delete - Bulk delete nodes
   */
  @Post('nodes/bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDeleteNodes(@Body() body: { nodeIds: string[] }) {
    this.logger.info('Bulk deleting nodes', { count: body.nodeIds.length });

    const results = await this.knowledgeGraphService.bulkDeleteNodes(
      body.nodeIds,
    );

    return {
      success: true,
      deleted: results.deleted,
      failed: results.failed,
      total: body.nodeIds.length,
    };
  }

  /**
   * POST /knowledge-graph/nodes/bulk-update - Bulk update nodes
   */
  @Post('nodes/bulk-update')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateNodes(
    @Body()
    body: {
      nodeIds: string[];
      updates: Record<string, any>;
    },
  ) {
    this.logger.info('Bulk updating nodes', {
      count: body.nodeIds.length,
    });

    const results = await this.knowledgeGraphService.bulkUpdateNodes(
      body.nodeIds,
      body.updates,
    );

    return {
      success: true,
      updated: results.updated,
      failed: results.failed,
      total: body.nodeIds.length,
    };
  }

  /**
   * GET /knowledge-graph/nodes/layers - Get nodes grouped by layer
   */
  @Get('nodes/layers')
  async getNodesByLayers() {
    this.logger.info('Getting nodes grouped by layers');

    const result = await this.knowledgeGraphService.getNodesByLayers();

    return {
      success: true,
      layers: result,
    };
  }

  /**
   * PATCH /knowledge-graph/nodes/:id/domain - Assign/update domain for L1 node
   */
  @Patch('nodes/:id/domain')
  async updateNodeDomain(
    @Param('id') nodeId: string,
    @Body() body: { domain: string; domainColor: string },
  ) {
    this.logger.info('Updating node domain', { nodeId, domain: body.domain });

    const node = await this.knowledgeGraphService.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Only allow domain assignment for L1 nodes
    if (node.layer !== ICSLayer.L1_OBSERVATIONS) {
      throw new Error('Domain assignment is only allowed for L1 nodes');
    }

    const updated = await this.knowledgeGraphService.updateNode(nodeId, {
      domain: body.domain,
      domainColor: body.domainColor,
    });

    return {
      success: true,
      node: updated,
    };
  }

  /**
   * GET /knowledge-graph/domains - Get all L1 domains with their assigned colors
   */
  @Get('domains')
  async getDomains() {
    this.logger.info('Getting all domains');

    const l1Nodes = await this.knowledgeGraphService.getNodesByLayer(
      ICSLayer.L1_OBSERVATIONS,
    );

    const domains = l1Nodes
      .filter((node) => node.domain && node.domainColor)
      .map((node) => ({
        domainName: node.domain,
        color: node.domainColor,
        nodeId: node.id,
        nodeLabel: node.label,
      }));

    // Remove duplicates by domain name (keep first occurrence)
    const uniqueDomains = Array.from(
      new Map(domains.map((d) => [d.domainName, d])).values(),
    );

    return {
      success: true,
      domains: uniqueDomains,
    };
  }

  /**
   * GET /knowledge-graph/nodes/:id/connected-domains - Get all L1 domains connected to node
   */
  @Get('nodes/:id/connected-domains')
  async getConnectedDomains(@Param('id') nodeId: string) {
    this.logger.info('Getting connected domains', { nodeId });

    const result = await this.knowledgeGraphService.getConnectedDomains(nodeId);

    return {
      success: true,
      nodeId,
      domains: result,
    };
  }

  /**
   * GET /knowledge-graph/nodes/:id/color - Get calculated color for node
   */
  @Get('nodes/:id/color')
  async getNodeColor(@Param('id') nodeId: string) {
    this.logger.info('Getting node color', { nodeId });

    const color = await this.knowledgeGraphService.calculateNodeColor(nodeId);

    return {
      success: true,
      nodeId,
      color,
    };
  }

  /**
   * POST /knowledge-graph/nodes/colors - Batch get colors for multiple nodes
   */
  @Post('nodes/colors')
  async getNodeColors(@Body() body: { nodeIds: string[] }) {
    this.logger.info('Getting node colors in batch', {
      count: body.nodeIds.length,
    });

    const colors: Record<string, string> = {};

    for (const nodeId of body.nodeIds) {
      try {
        const color = await this.knowledgeGraphService.calculateNodeColor(
          nodeId,
        );
        colors[nodeId] = color;
      } catch (error) {
        this.logger.warn('Failed to calculate color for node', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
        });
        colors[nodeId] = '#808080'; // Default gray
      }
    }

    return {
      success: true,
      colors,
    };
  }
}
