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
import { ILogger } from '@application/ports/logger.port';
import { ICSLayer } from '@infrastructure/adapters/knowledge-graph/neo4j.adapter';

/**
 * Knowledge Graph Controller
 */
@Controller('knowledge-graph')
export class KnowledgeGraphController {
  constructor(
    private readonly knowledgeGraphService: KnowledgeGraphService,
    @Inject('ILogger')
    private readonly logger: ILogger,
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
}
