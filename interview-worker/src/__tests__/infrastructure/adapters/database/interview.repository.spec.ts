/**
 * Interview Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoInterviewRepository } from '../../../../infrastructure/adapters/database/interview.repository';
import { Interview } from '../../../../domain/entities';

describe('MongoInterviewRepository', () => {
  let repository: MongoInterviewRepository;
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
        MongoInterviewRepository,
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

    repository = module.get<MongoInterviewRepository>(MongoInterviewRepository);

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('interviews').deleteMany({});
  });

  it('should save and retrieve interview', async () => {
    const interview = new Interview({
      id: 'test-interview',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    await repository.save(interview);
    const retrieved = await repository.findById('test-interview');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-interview');
    expect(retrieved?.title).toBe('Test Interview');
  });

  it('should find all interviews', async () => {
    const interview1 = new Interview({
      id: 'i1',
      title: 'Interview 1',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    const interview2 = new Interview({
      id: 'i2',
      title: 'Interview 2',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 90,
      },
      rubric: { overall: { weights: {} } },
    });

    await repository.save(interview1);
    await repository.save(interview2);

    const allInterviews = await repository.findAll();

    expect(allInterviews.length).toBeGreaterThanOrEqual(2);
  });

  it('should update interview', async () => {
    const interview = new Interview({
      id: 'test-interview',
      title: 'Original Title',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    await repository.save(interview);

    const updated = await repository.update('test-interview', {
      title: 'Updated Title',
    });

    expect(updated?.title).toBe('Updated Title');
  });

  it('should delete interview', async () => {
    const interview = new Interview({
      id: 'test-interview',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    await repository.save(interview);
    const deleted = await repository.delete('test-interview');

    expect(deleted).toBe(true);

    const retrieved = await repository.findById('test-interview');
    expect(retrieved).toBeNull();
  });
});

