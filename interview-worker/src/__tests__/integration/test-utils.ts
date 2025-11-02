/**
 * Integration Test Utilities
 * 
 * Helper functions and fixtures for integration testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;
let mongoDb: Db;

/**
 * Create a test application instance with in-memory MongoDB
 */
export async function createTestApp(): Promise<INestApplication> {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory MongoDB
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db();

  // Set environment variables for test
  process.env.MONGODB_URI = mongoUri;
  process.env.MONGODB_DATABASE = 'test_db';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(app: INestApplication): Promise<void> {
  if (mongoDb) {
    const collections = await mongoDb.listCollections().toArray();
    for (const collection of collections) {
      await mongoDb.collection(collection.name).deleteMany({});
    }
  }
}

/**
 * Close test application and MongoDB connections
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Test fixtures
 */
export const testFixtures = {
  candidateId: 'test-candidate-123',
  interviewId: 'test-interview-123',
  sessionId: 'test-session-123',
  questionId: 'test-question-123',

  interview: {
    title: 'Test Interview',
    description: 'Test interview for unit testing',
    phases: [
      {
        phaseId: 'phase-1',
        type: 'technical' as const,
        duration: 30,
        difficulty: 'medium' as const,
        questionCount: 3,
      },
      {
        phaseId: 'phase-2',
        type: 'behavioral' as const,
        duration: 20,
        difficulty: 'easy' as const,
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
          technical: 0.6,
          behavioral: 0.4,
        },
      },
    },
  },

  question: {
    questionId: 'test-question-1',
    text: 'What is the time complexity of binary search?',
    category: 'technical',
    difficulty: 'medium' as const,
    phase: 'phase-1',
    tags: ['algorithms', 'complexity'],
  },

  session: {
    interviewId: 'test-interview-123',
    candidateId: 'test-candidate-123',
    communicationMode: 'text' as const,
  },

  response: {
    questionId: 'test-question-1',
    candidateResponse: 'Binary search has O(log n) time complexity.',
    communicationMode: 'text' as const,
  },

  profile: {
    sessionId: 'test-session-123',
    strengths: ['Strong understanding of algorithms'],
    concerns: [],
    observations: {
      strengths: ['Strong understanding of algorithms'],
      concerns: [],
      notes: [],
    },
  },
};

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Assert response structure
 */
export function assertValidResponse(response: any, expectedKeys: string[]): void {
  expect(response).toBeDefined();
  
  for (const key of expectedKeys) {
    expect(response).toHaveProperty(key);
  }
}

/**
 * Create mock LLM response
 */
export function createMockLLMResponse(content: string): any {
  return {
    content,
    role: 'assistant',
    metadata: {
      model: 'mock-llm',
      tokens: Math.ceil(content.length / 4),
    },
  };
}

/**
 * Get test MongoDB database instance
 */
export function getTestDb(): Db {
  return mongoDb;
}

