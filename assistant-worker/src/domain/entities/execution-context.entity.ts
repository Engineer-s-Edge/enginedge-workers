/**
 * ExecutionContext Entity
 *
 * Represents the context in which an agent executes.
 * Contains user info, session info, and execution metadata.
 */

export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  contextId: string;
  input?: string;
  config?: Record<string, unknown>;
  memory?: {
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp?: Date;
      metadata?: Record<string, unknown>;
    }>;
  };
  // Combined memory context from all active memory types
  // This is populated by the agent execution service using MemoryService.getCombinedContext()
  memoryContext?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  tools?: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
  // Agent-specific context properties
  subAgents?: string[];
  phases?: Array<'aim' | 'shoot' | 'skin'>;
  startNode?: string;
  strategy?: string;
}

/**
 * Create a new execution context
 */
export function createExecutionContext(
  overrides?: Partial<ExecutionContext>,
): ExecutionContext {
  return {
    contextId: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Update execution context
 */
export function updateExecutionContext(
  context: ExecutionContext,
  updates: Partial<ExecutionContext>,
): ExecutionContext {
  return {
    ...context,
    ...updates,
    updatedAt: new Date(),
  };
}
