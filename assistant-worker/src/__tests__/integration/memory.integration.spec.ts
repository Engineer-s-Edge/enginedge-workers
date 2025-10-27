/**
 * Memory Integration Tests
 * 
 * End-to-end tests for memory operations.
 */

import { INestApplication } from '@nestjs/common';
import { createTestApp, testFixtures } from './test-utils';
import * as request from 'supertest';

describe('Memory Integration Tests', () => {
  let app: INestApplication;
  const conversationId = 'test-conversation-123';

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Memory Operations', () => {
    it('should add messages to memory', async () => {
      const response = await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({
          role: 'user',
          content: 'Hello, world!',
          memoryType: 'buffer',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.conversationId).toBe(conversationId);
    });

    it('should retrieve messages from memory', async () => {
      // Add some messages first
      await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({ role: 'user', content: 'Message 1' });

      await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({ role: 'assistant', content: 'Response 1' });

      // Retrieve messages
      const response = await request(app.getHttpServer())
        .get(`/memory/${conversationId}?memoryType=buffer`)
        .expect(200);

      expect(response.body.messages).toBeDefined();
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should get formatted context', async () => {
      const response = await request(app.getHttpServer())
        .get(`/memory/${conversationId}/context?memoryType=buffer`)
        .expect(200);

      expect(response.body.context).toBeDefined();
      expect(typeof response.body.context).toBe('string');
    });

    it('should clear memory', async () => {
      const clearResponse = await request(app.getHttpServer())
        .delete(`/memory/${conversationId}?memoryType=buffer`)
        .expect(204);

      expect(clearResponse.body.success).toBe(true);
    });
  });

  describe('Memory Types', () => {
    it('should work with buffer memory', async () => {
      await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({
          role: 'user',
          content: 'Buffer test',
          memoryType: 'buffer',
        })
        .expect(201);
    });

    it('should work with window memory', async () => {
      await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({
          role: 'user',
          content: 'Window test',
          memoryType: 'window',
        })
        .expect(201);
    });

    it('should work with summary memory', async () => {
      await request(app.getHttpServer())
        .post(`/memory/${conversationId}/messages`)
        .send({
          role: 'user',
          content: 'Summary test',
          memoryType: 'summary',
        })
        .expect(201);
    });
  });

  describe('Advanced Memory Features', () => {
    it('should get conversation summary', async () => {
      const response = await request(app.getHttpServer())
        .get(`/memory/${conversationId}/summary`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
    });

    it('should search for similar messages', async () => {
      const response = await request(app.getHttpServer())
        .post(`/memory/${conversationId}/search`)
        .send({
          query: 'test message',
          topK: 5,
        })
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should get extracted entities', async () => {
      const response = await request(app.getHttpServer())
        .get(`/memory/${conversationId}/entities`)
        .expect(200);

      expect(response.body.entities).toBeDefined();
      expect(Array.isArray(response.body.entities)).toBe(true);
    });
  });
});

