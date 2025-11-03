/**
 * Application Ports (Interfaces)
 *
 * These ports define the contracts that infrastructure adapters must implement.
 * Following the Dependency Inversion Principle (DIP).
 */

export { ILogger } from './logger.port';
export { ILLMProvider, LLMRequest, LLMResponse } from './llm-provider.port';
