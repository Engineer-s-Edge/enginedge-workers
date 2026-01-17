/**
 * Profile Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoCandidateProfileRepository } from '../../../../infrastructure/adapters/database/profile.repository';
import { CandidateProfile } from '../../../../domain/entities';

describe('MongoCandidateProfileRepository', () => {
  let repository: MongoCandidateProfileRepository;
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
        MongoCandidateProfileRepository,
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

    repository = module.get<MongoCandidateProfileRepository>(
      MongoCandidateProfileRepository,
    );

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('candidate_profiles').deleteMany({});
  });

  it('should save and retrieve profile', async () => {
    const profile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['Good communication'],
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
    });

    await repository.save(profile);
    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.profileId).toBe('p1');
    expect(retrieved?.sessionId).toBe('s1');
  });

  it('should update existing profile', async () => {
    const profile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
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
    });

    await repository.save(profile);

    const updated = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['New strength'],
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
    });

    await repository.save(updated);
    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved?.observations.strengths).toContain('New strength');
  });

  it('should return null for non-existent profile', async () => {
    const retrieved = await repository.findBySessionId('non-existent');
    expect(retrieved).toBeNull();
  });
});
