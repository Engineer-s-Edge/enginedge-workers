/**
 * Transcript Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoTranscriptRepository } from '../../../../infrastructure/adapters/database/transcript.repository';
import { Transcript } from '../../../../domain/entities';

describe('MongoTranscriptRepository', () => {
  let repository: MongoTranscriptRepository;
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
        MongoTranscriptRepository,
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

    repository = module.get<MongoTranscriptRepository>(MongoTranscriptRepository);

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('transcripts').deleteMany({});
  });

  it('should save and retrieve transcript', async () => {
    const transcript: Transcript = {
      sessionId: 's1',
      messages: [
        {
          timestamp: new Date(),
          speaker: 'candidate',
          text: 'Hello',
          type: 'user-input',
        },
      ],
    };

    await repository.save(transcript);
    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe('s1');
    expect(retrieved?.messages).toHaveLength(1);
  });

  it('should append message to transcript', async () => {
    const transcript: Transcript = {
      sessionId: 's1',
      messages: [
        {
          timestamp: new Date(),
          speaker: 'candidate',
          text: 'First message',
          type: 'user-input',
        },
      ],
    };

    await repository.save(transcript);

    await repository.appendMessage('s1', {
      timestamp: new Date(),
      speaker: 'agent',
      text: 'Agent response',
      type: 'agent-response',
    });

    const retrieved = await repository.findBySessionId('s1');

    expect(retrieved?.messages).toHaveLength(2);
    expect(retrieved?.messages[1].text).toBe('Agent response');
    expect(retrieved?.messages[1].speaker).toBe('agent');
  });

  it('should return null for non-existent transcript', async () => {
    const retrieved = await repository.findBySessionId('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should create new transcript when appending to non-existent session', async () => {
    await repository.appendMessage('new-session', {
      timestamp: new Date(),
      speaker: 'candidate',
      text: 'New message',
      type: 'user-input',
    });

    const retrieved = await repository.findBySessionId('new-session');

    expect(retrieved).toBeDefined();
    expect(retrieved?.messages).toHaveLength(1);
    expect(retrieved?.messages[0].text).toBe('New message');
  });
});

