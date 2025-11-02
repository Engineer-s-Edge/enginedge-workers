/**
 * Report Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoInterviewReportRepository } from '../../../../infrastructure/adapters/database/report.repository';
import { InterviewReport } from '../../../../domain/entities';

describe('MongoInterviewReportRepository', () => {
  let repository: MongoInterviewReportRepository;
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
        MongoInterviewReportRepository,
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

    repository = module.get<MongoInterviewReportRepository>(
      MongoInterviewReportRepository,
    );

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('interview_reports').deleteMany({});
  });

  it('should save and retrieve report', async () => {
    const report = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: {
        overall: 85,
        byPhase: {
          technical: 90,
        },
      },
      feedback: 'Strong candidate',
      observations: {
        strengths: ['Good problem-solving'],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
      transcript: {
        sessionId: 's1',
        messages: [],
      },
    });

    await repository.save(report);
    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.reportId).toBe('r1');
    expect(retrieved?.score.overall).toBe(85);
  });

  it('should return null for non-existent report', async () => {
    const retrieved = await repository.findBySessionId('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should update existing report', async () => {
    const report = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: {
        overall: 85,
        byPhase: {},
      },
      feedback: 'Original feedback',
      observations: {
        strengths: [],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
      transcript: {
        sessionId: 's1',
        messages: [],
      },
    });

    await repository.save(report);

    const updated = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: {
        overall: 90,
        byPhase: {},
      },
      feedback: 'Updated feedback',
      observations: report.observations,
      transcript: report.transcript,
    });

    await repository.save(updated);
    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved?.score.overall).toBe(90);
    expect(retrieved?.feedback).toBe('Updated feedback');
  });
});

