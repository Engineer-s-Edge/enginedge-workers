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

// Mock MongooseModule to prevent connection
jest.mock('@nestjs/mongoose', () => {
  const original = jest.requireActual('@nestjs/mongoose');
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
        const providers = models.map((model: any) => ({
          provide: original.getModelToken(model.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            findOne: jest.fn().mockReturnThis(),
            findById: jest.fn().mockReturnThis(),
            create: jest.fn(),
            updateOne: jest.fn().mockReturnThis(),
            deleteOne: jest.fn().mockReturnThis(),
            exec: jest.fn(),
            save: jest.fn(),
            constructor: jest.fn(),
          },
        }));
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
  for (const agentId of agentIds) {
    try {
      await app.get('AgentService').deleteAgent(agentId, testFixtures.userId);
    } catch (error) {
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
