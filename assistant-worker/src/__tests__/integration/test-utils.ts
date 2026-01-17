/**
 * Integration Test Utilities
 *
 * Helper functions and fixtures for integration testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

// Mock Redis before other imports
jest.mock('ioredis', () => {
  return class MockRedis {
    on = jest.fn();
    publish = jest.fn();
    subscribe = jest.fn();
    set = jest.fn();
    get = jest.fn();
    expire = jest.fn();
    del = jest.fn();
    quit = jest.fn();
    disconnect = jest.fn();
    connect = jest.fn().mockResolvedValue('OK');
    duplicate = jest.fn().mockReturnThis();
    status = 'ready';
  };
});

// Mock Kafka
jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue([{ errorCode: 0 }]),
        on: jest.fn(),
      })),
      consumer: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      })),
      admin: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        listTopics: jest.fn().mockResolvedValue([]),
        createTopics: jest.fn(),
      })),
    })),
    Partitioners: {
      LegacyPartitioner: jest.fn(),
      DefaultPartitioner: jest.fn(),
    },
  };
});

// Global store for in-memory DB
const globalStore = new Map<string, Map<string, any>>();

const getCollection = (modelName: string) => {
  if (!globalStore.has(modelName)) {
    globalStore.set(modelName, new Map());
  }
  return globalStore.get(modelName)!;
};

// Mock MongooseModule to prevent connection and provide in-memory storage
jest.mock('@nestjs/mongoose', () => {
  const original = jest.requireActual('@nestjs/mongoose');

  // Helper to create a chainable query object
  const createQuery = (result: any) => ({
    exec: jest.fn().mockResolvedValue(result),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  });

  return {
    ...original,
    MongooseModule: {
      ...original.MongooseModule,
      forRoot: jest.fn().mockImplementation(() => ({
        module: class FakeMongooseModule {},
        providers: [],
        exports: [],
      })),
      forFeature: jest.fn().mockImplementation((models) => {
        const providers = models.map((model: any) => {
          const modelName = model.name;

          const mockModel = {
            // Create
            create: jest.fn().mockImplementation((dto) => {
              // Ensure _id exists
              const id =
                dto._id || dto.id || Math.random().toString(36).substring(7);
              const doc = { ...dto, _id: id, id };
              // Add to store
              getCollection(modelName).set(id, doc);
              return Promise.resolve(doc);
            }),

            // Find By ID
            findById: jest.fn().mockImplementation((id) => {
              const doc = getCollection(modelName).get(id);
              return createQuery(doc || null);
            }),

            // Find One
            findOne: jest.fn().mockImplementation((query) => {
              const collection = getCollection(modelName);
              let found = null;

              if (!query || Object.keys(query).length === 0) {
                found = collection.values().next().value;
              } else {
                for (const item of collection.values()) {
                  let match = true;
                  for (const [key, value] of Object.entries(query)) {
                    if (item[key] !== value) {
                      match = false;
                      break;
                    }
                  }
                  if (match) {
                    found = item;
                    break;
                  }
                }
              }
              return createQuery(found);
            }),

            // Find (All or filter)
            find: jest.fn().mockImplementation((query) => {
              const collection = getCollection(modelName);
              let results: any[] = [];

              if (!query || Object.keys(query).length === 0) {
                results = Array.from(collection.values());
              } else {
                for (const item of collection.values()) {
                  let match = true;
                  for (const [key, value] of Object.entries(query)) {
                    // Basic exact match support
                    if (item[key] !== value) {
                      match = false;
                      break;
                    }
                  }
                  if (match) results.push(item);
                }
              }
              return createQuery(results);
            }),

            // Update One
            updateOne: jest.fn().mockImplementation((query, update) => {
              // Simple implementation - find one and update
              // This is a bit tricky without real query parsing
              return createQuery({ modifiedCount: 1 });
            }),

            // Delete One
            deleteOne: jest.fn().mockImplementation((query) => {
              // Assuming query is { _id: ... } or similar
              const collection = getCollection(modelName);
              if (query._id) {
                const existed = collection.delete(query._id);
                return createQuery({ deletedCount: existed ? 1 : 0 });
              } else if (query.id) {
                const existed = collection.delete(query.id);
                return createQuery({ deletedCount: existed ? 1 : 0 });
              }

              // Fallback: iterate
              for (const [id, item] of collection.entries()) {
                let match = true;
                for (const [key, value] of Object.entries(query)) {
                  if (item[key] !== value) {
                    match = false;
                    break;
                  }
                }
                if (match) {
                  collection.delete(id);
                  return createQuery({ deletedCount: 1 });
                }
              }
              return createQuery({ deletedCount: 0 });
            }),

            constructor: jest.fn(),
          };

          return {
            provide: original.getModelToken(modelName),
            useValue: mockModel,
          };
        });

        return {
          module: class FakeMongooseFeatureModule {},
          providers: providers,
          exports: providers.map((p: any) => p.provide),
        };
      }),
    },
  };
});

import { AppModule } from '../../app.module'; // Adjust path if needed
import { MongooseModule } from '@nestjs/mongoose';
import { AgentService } from '../../application/services/agent.service';

/**
 * Create a test application instance
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MongooseModule)
    .useValue({
      forRoot: jest.fn(),
      forFeature: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  // Avoid app.init() if it connects to DB, or ensure mocks prevent connection
  // But usually we need init.
  // If we can't mock MongooseModule easily (it's dynamic), we might need to override the config
  // to point to something else or trust that compiled module mocks work.
  // Actually, overriding MongooseModule class won't work for dynamic imports.
  // Better to override the DbConnection token or similar.
  await app.init();

  return app;
}

/**
 * Test fixtures
 */
export const testFixtures = {
  userId: 'test-user-123',

  agentConfigs: {
    react: {
      name: 'Test ReAct Agent',
      type: 'react' as const,
      config: {
        maxIterations: 5,
        temperature: 0.7,
      },
    },
    graph: {
      name: 'Test Graph Agent',
      type: 'graph' as const,
      config: {
        workflow: {
          nodes: [
            { id: 'start', type: 'start', config: {} },
            { id: 'process', type: 'llm', config: {} },
            { id: 'end', type: 'end', config: {} },
          ],
          edges: [
            { from: 'start', to: 'process' },
            { from: 'process', to: 'end' },
          ],
        },
      },
    },
    expert: {
      name: 'Test Expert Agent',
      type: 'expert' as const,
      config: {
        maxSources: 10,
        researchDepth: 'medium' as const,
      },
    },
  },

  messages: [
    { role: 'user', content: 'Hello, how are you?' },
    { role: 'assistant', content: 'I am doing well, thank you!' },
    { role: 'user', content: 'What is the weather like?' },
  ],

  knowledgeGraph: {
    concept: 'Artificial Intelligence',
    observations: [
      'Neural networks process data',
      'Machine learning improves with data',
    ],
    patterns: [
      'Data quality affects performance',
      'More layers enable complex patterns',
    ],
    models: ['Deep learning architecture', 'Transformer model'],
    theories: ['Universal approximation theorem', 'Information theory'],
    principles: ['Learning from experience', 'Pattern recognition'],
    synthesis: 'AI systems learn patterns from data to make predictions',
  },
};

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
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
 * Clean up test data
 */
export async function cleanupTestData(
  app: INestApplication,
  agentIds: string[],
): Promise<void> {
  // Clean up agents
  const agentService = app.get(AgentService);
  for (const agentId of agentIds) {
    try {
      await agentService.deleteAgent(agentId, testFixtures.userId);
    } catch (error) {
      // console.error(`Failed to cleanup agent ${agentId}:`, error);
      // Ignore errors during cleanup
    }
  }
}

/**
 * Assert response structure
 */
export function assertValidResponse(
  response: any,
  expectedKeys: string[],
): void {
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
      tokens: content.length / 4,
    },
  };
}
