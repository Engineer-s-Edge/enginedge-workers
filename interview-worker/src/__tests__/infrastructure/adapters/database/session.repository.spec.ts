/**
 * Session Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoInterviewSessionRepository } from '../../../../infrastructure/adapters/database/session.repository';
import { InterviewSession } from '../../../../domain/entities';

describe('MongoInterviewSessionRepository', () => {
  let repository: MongoInterviewSessionRepository;
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
        MongoInterviewSessionRepository,
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

    repository = module.get<MongoInterviewSessionRepository>(
      MongoInterviewSessionRepository,
    );

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up between tests
    await db.collection('sessions').deleteMany({});
  });

  it('should save and retrieve session', async () => {
    const session = new InterviewSession({
      sessionId: 'test-session-1',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    await repository.save(session);
    const retrieved = await repository.findById('test-session-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe('test-session-1');
    expect(retrieved?.status).toBe('in-progress');
  });

  it('should update existing session', async () => {
    const session = new InterviewSession({
      sessionId: 'test-session-2',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    await repository.save(session);

    const updated = new InterviewSession({
      ...session,
      status: 'paused',
      pausedAt: new Date(),
    });

    await repository.save(updated);
    const retrieved = await repository.findById('test-session-2');

    expect(retrieved?.status).toBe('paused');
    expect(retrieved?.pausedAt).toBeDefined();
  });

  it('should find sessions by interview ID', async () => {
    const session1 = new InterviewSession({
      sessionId: 'session-1',
      interviewId: 'interview-1',
      candidateId: 'candidate-1',
      status: 'in-progress',
      communicationMode: 'text',
    });

    const session2 = new InterviewSession({
      sessionId: 'session-2',
      interviewId: 'interview-1',
      candidateId: 'candidate-2',
      status: 'in-progress',
      communicationMode: 'text',
    });

    await repository.save(session1);
    await repository.save(session2);

    const sessions = await repository.findByInterviewId('interview-1');

    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.interviewId === 'interview-1')).toBe(true);
  });

  it('should find sessions by candidate ID', async () => {
    const session = new InterviewSession({
      sessionId: 'session-3',
      interviewId: 'interview-1',
      candidateId: 'candidate-3',
      status: 'in-progress',
      communicationMode: 'text',
    });

    await repository.save(session);

    const sessions = await repository.findByCandidateId('candidate-3');

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].candidateId).toBe('candidate-3');
  });

  it('should return null for non-existent session', async () => {
    const retrieved = await repository.findById('non-existent');
    expect(retrieved).toBeNull();
  });
});

