/**
 * Execution DTOs
 *
 * Application layer DTOs for assistant execution
 */

import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export class ExecuteAssistantDto {
  @IsOptional()
  input?: any;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsObject()
  options?: {
    traceExecution?: boolean;
    requireToolApproval?: boolean;
    specificToolsRequiringApproval?: string[];
    llmProvider?: string;
    llmModel?: string;
    temperature?: number;
    streaming?: boolean;
    maxTokens?: number;
    history?: Array<HumanMessage | AIMessage>;
  };
}
