/**
 * Knowledge Graph Integration Tests
 *
 * End-to-end tests for knowledge graph operations.
 */

import { INestApplication } from '@nestjs/common';
import { createTestApp, testFixtures } from './test-utils';
import * as request from 'supertest';

describe('Knowledge Graph Integration Tests', () => {
  let app: INestApplication;
  const createdNodeIds: string[] = [];
  const createdEdgeIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    // Clean up created nodes and edges
    for (const edgeId of createdEdgeIds) {
      try {
        await request(app.getHttpServer()).delete(
          `/knowledge-graph/edges/${edgeId}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const nodeId of createdNodeIds) {
      try {
        await request(app.getHttpServer()).delete(
          `/knowledge-graph/nodes/${nodeId}`,
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    await app.close();
  });

  describe('Node Operations', () => {
    it('should create a node', async () => {
      const response = await request(app.getHttpServer())
        .post('/knowledge-graph/nodes')
        .send({
          label: 'Test Node',
          type: 'concept',
          layer: 'L3_MODELS',
          properties: { description: 'A test node' },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.node).toBeDefined();
      expect(response.body.node.label).toBe('Test Node');

      createdNodeIds.push(response.body.node.id);
    });

    it('should get a node by ID', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/knowledge-graph/nodes')
        .send({
          label: 'Get Test Node',
          type: 'concept',
          layer: 'L1_OBSERVATIONS',
        });

      const nodeId = createResponse.body.node.id;
      createdNodeIds.push(nodeId);

      const response = await request(app.getHttpServer())
        .get(`/knowledge-graph/nodes/${nodeId}`)
        .expect(200);

      expect(response.body.node).toBeDefined();
      expect(response.body.node.id).toBe(nodeId);
    });

    it('should delete a node', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/knowledge-graph/nodes')
        .send({
          label: 'Delete Test Node',
          type: 'concept',
          layer: 'L2_PATTERNS',
        });

      const nodeId = createResponse.body.node.id;

      await request(app.getHttpServer())
        .delete(`/knowledge-graph/nodes/${nodeId}`)
        .expect(204);
    });
  });

  describe('Edge Operations', () => {
    it('should create an edge between nodes', async () => {
      // Create two nodes
      const node1Response = await request(app.getHttpServer())
        .post('/knowledge-graph/nodes')
        .send({
          label: 'Node 1',
          type: 'concept',
          layer: 'L1_OBSERVATIONS',
        });

      const node2Response = await request(app.getHttpServer())
        .post('/knowledge-graph/nodes')
        .send({
          label: 'Node 2',
          type: 'concept',
          layer: 'L2_PATTERNS',
        });

      const node1Id = node1Response.body.node.id;
      const node2Id = node2Response.body.node.id;
      createdNodeIds.push(node1Id, node2Id);

      // Create edge
      const edgeResponse = await request(app.getHttpServer())
        .post('/knowledge-graph/edges')
        .send({
          from: node1Id,
          to: node2Id,
          type: 'SUPPORTS',
          properties: { strength: 0.8 },
        })
        .expect(201);

      expect(edgeResponse.body.success).toBe(true);
      expect(edgeResponse.body.edge).toBeDefined();

      createdEdgeIds.push(edgeResponse.body.edge.id);
    });
  });

  describe('ICS Hierarchy', () => {
    it('should build ICS hierarchy', async () => {
      const response = await request(app.getHttpServer())
        .post('/knowledge-graph/ics/build')
        .send(testFixtures.knowledgeGraph)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.rootNode).toBeDefined();
      expect(response.body.layerCounts).toBeDefined();

      // Store created node IDs for cleanup
      createdNodeIds.push(response.body.rootNode.id);
    });

    it('should get nodes by layer', async () => {
      const response = await request(app.getHttpServer())
        .get('/knowledge-graph/nodes/layer/L1_OBSERVATIONS')
        .expect(200);

      expect(response.body.nodes).toBeDefined();
      expect(Array.isArray(response.body.nodes)).toBe(true);
    });
  });

  describe('Graph Queries', () => {
    it('should search nodes', async () => {
      const response = await request(app.getHttpServer())
        .post('/knowledge-graph/search')
        .send({
          searchTerm: 'test',
        })
        .expect(200);

      expect(response.body.nodes).toBeDefined();
      expect(Array.isArray(response.body.nodes)).toBe(true);
    });

    it('should get graph statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/knowledge-graph/stats')
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.totalNodes).toBeDefined();
      expect(response.body.stats.totalEdges).toBeDefined();
    });
  });
});
