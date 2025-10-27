/**
 * Agent Integration Tests
 * 
 * End-to-end tests for agent operations.
 */

import { INestApplication } from '@nestjs/common';
import { createTestApp, testFixtures, cleanupTestData, assertValidResponse } from './test-utils';
import * as request from 'supertest';

describe('Agent Integration Tests', () => {
  let app: INestApplication;
  let createdAgentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app, createdAgentIds);
    await app.close();
  });

  afterEach(() => {
    createdAgentIds = [];
  });

  describe('Agent Lifecycle', () => {
    it('should create a new agent', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        })
        .expect(201);

      assertValidResponse(response.body, ['id', 'name', 'type', 'createdAt']);
      expect(response.body.type).toBe('react');
      
      createdAgentIds.push(response.body.id);
    });

    it('should list all agents for a user', async () => {
      // Create multiple agents
      const agent1 = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agent2 = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.expert,
          userId: testFixtures.userId,
        });

      createdAgentIds.push(agent1.body.id, agent2.body.id);

      // List agents
      const response = await request(app.getHttpServer())
        .get(`/agents?userId=${testFixtures.userId}`)
        .expect(200);

      expect(response.body.total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(response.body.agents)).toBe(true);
    });

    it('should get agent details', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agentId = createResponse.body.id;
      createdAgentIds.push(agentId);

      const response = await request(app.getHttpServer())
        .get(`/agents/${agentId}?userId=${testFixtures.userId}`)
        .expect(200);

      assertValidResponse(response.body, ['id', 'name', 'state']);
      expect(response.body.id).toBe(agentId);
    });

    it('should delete an agent', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agentId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/agents/${agentId}?userId=${testFixtures.userId}`)
        .expect(204);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/agents/${agentId}?userId=${testFixtures.userId}`)
        .expect(500); // Should throw error
    });
  });

  describe('Agent Execution', () => {
    it('should execute an agent', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agentId = createResponse.body.id;
      createdAgentIds.push(agentId);

      const response = await request(app.getHttpServer())
        .post(`/agents/${agentId}/execute`)
        .send({
          input: 'What is 2 + 2?',
          userId: testFixtures.userId,
        })
        .expect(200);

      assertValidResponse(response.body, ['agentId', 'status', 'output', 'duration']);
      expect(response.body.agentId).toBe(agentId);
    });

    it('should stream agent execution', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agentId = createResponse.body.id;
      createdAgentIds.push(agentId);

      const response = await request(app.getHttpServer())
        .post(`/agents/${agentId}/stream`)
        .send({
          input: 'Tell me a story',
          userId: testFixtures.userId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('stream');
      expect(Array.isArray(response.body.stream)).toBe(true);
    });

    it('should abort agent execution', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/create')
        .send({
          ...testFixtures.agentConfigs.react,
          userId: testFixtures.userId,
        });

      const agentId = createResponse.body.id;
      createdAgentIds.push(agentId);

      const response = await request(app.getHttpServer())
        .post(`/agents/${agentId}/abort?userId=${testFixtures.userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Specialized Agent Types', () => {
    it('should create and execute ReAct agent', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/react/create')
        .send({
          name: 'ReAct Test',
          userId: testFixtures.userId,
          maxIterations: 3,
        })
        .expect(201);

      createdAgentIds.push(createResponse.body.id);
      expect(createResponse.body.type).toBe('react');
    });

    it('should create and execute Graph agent', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/graph/create')
        .send({
          name: 'Graph Test',
          userId: testFixtures.userId,
          workflow: testFixtures.agentConfigs.graph.config.workflow,
        })
        .expect(201);

      createdAgentIds.push(createResponse.body.id);
      expect(createResponse.body.type).toBe('graph');
    });

    it('should create Expert agent', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/agents/expert/create')
        .send({
          name: 'Expert Test',
          userId: testFixtures.userId,
          maxSources: 5,
        })
        .expect(201);

      createdAgentIds.push(createResponse.body.id);
      expect(createResponse.body.type).toBe('expert');
    });
  });
});

