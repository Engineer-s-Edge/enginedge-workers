/**
 * Response Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoInterviewResponseRepository } from '../../../../infrastructure/adapters/database/response.repository';
import { InterviewResponse } from '../../../../domain/entities';

describe('MongoInterviewResponseRepository', () => {
  let repository: MongoInterviewResponseRepository;
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('test_db');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoInterviewResponseRepository,
        {
          provide: 'MONGODB_DB',
          useValue: db,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<MongoInterviewResponseRepository>(
      MongoInterviewResponseRepository,
    );

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('interview_responses').deleteMany({});
  });

  it('should save and retrieve response', async () => {
    const response = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    });

    await repository.save(response);
    const retrieved = await repository.findById('r1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.responseId).toBe('r1');
    expect(retrieved?.candidateResponse).toBe('My answer');
  });

  it('should find responses by session ID', async () => {
    const response1 = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'Answer 1',
      submittedAt: new Date(),
    });

    const response2 = new InterviewResponse({
      responseId: 'r2',
      sessionId: 's1',
      questionId: 'q2',
      candidateResponse: 'Answer 2',
      submittedAt: new Date(),
    });

    await repository.save(response1);
    await repository.save(response2);

    const responses = await repository.findBySessionId('s1');

    expect(responses.length).toBeGreaterThanOrEqual(2);
    expect(responses.every((r) => r.sessionId === 's1')).toBe(true);
  });

  it('should find response by session and question', async () => {
    const response = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    });

    await repository.save(response);

    const retrieved = await repository.findBySessionAndQuestion('s1', 'q1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.questionId).toBe('q1');
  });

  it('should return null for non-existent response', async () => {
    const retrieved = await repository.findById('non-existent');
    expect(retrieved).toBeNull();
  });
});
