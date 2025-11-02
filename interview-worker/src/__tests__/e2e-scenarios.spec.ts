/**
 * E2E Scenario Tests
 * 
 * Comprehensive end-to-end workflow tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

describe('Interview Worker E2E Scenarios', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();

    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DATABASE = 'test_db';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Complete Interview Flow', () => {
    let interviewId: string;
    let sessionId: string;

    it('should create an interview', async () => {
      const response = await request(app.getHttpServer())
        .post('/interviews')
        .send({
          title: 'E2E Test Interview',
          description: 'End-to-end test',
          phases: [
            {
              phaseId: 'phase-1',
              type: 'technical',
              duration: 30,
              difficulty: 'medium',
              questionCount: 2,
            },
          ],
          config: {
            allowPause: true,
            maxPauseDuration: null,
            allowSkip: true,
            maxSkips: null,
            totalTimeLimit: 60,
          },
          rubric: {
            overall: {
              weights: {
                technical: 1.0,
              },
            },
          },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      interviewId = response.body.id;
    });

    it('should start a session', async () => {
      const response = await request(app.getHttpServer())
        .post('/sessions')
        .send({
          interviewId,
          candidateId: 'e2e-candidate',
          communicationMode: 'text',
        })
        .expect(201);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.status).toBe('in-progress');
      sessionId = response.body.sessionId;
    });

    it('should pause and resume session', async () => {
      // Pause
      const pausedResponse = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/pause`)
        .expect(200);

      expect(pausedResponse.body.status).toBe('paused');

      // Resume
      const resumedResponse = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/resume`)
        .expect(200);

      expect(resumedResponse.body.status).toBe('in-progress');
    });

    it('should retrieve session status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/sessions/${sessionId}`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.status).toBeDefined();
    });

    it('should get health check', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
    });
  });

  describe('Interview Management', () => {
    it('should list all interviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/interviews')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

