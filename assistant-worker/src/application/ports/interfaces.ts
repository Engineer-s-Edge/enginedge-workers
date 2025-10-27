import { LLMRequest, LLMResponse } from '../../domain/entities/llm.entities';

/**
 * LLM Service Interface
 * 
 * Port for LLM operations in the application layer
 */
export interface ILLMService {
  processRequest(request: LLMRequest): Promise<LLMResponse>;
}