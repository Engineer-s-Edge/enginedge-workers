/**
 * Integration Test Utilities
 *
 * Helper functions and fixtures for integration testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';

/**
 * Create a test application instance
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
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
