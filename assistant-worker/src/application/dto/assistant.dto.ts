/**
 * Assistant DTOs
 *
 * Application layer DTOs for assistant operations
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AssistantType,
  AssistantMode,
  AssistantStatus,
  CustomPrompt,
  ContextBlock,
  AssistantToolConfig,
  NodeConfig,
  CoTConfig,
  IntelligenceConfig,
  ReActAgentConfig,
  GraphNode,
  GraphEdge,
  GraphAgentConfig,
} from '@domain/entities/assistant.entity';

export class CreateAssistantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AssistantType)
  type?: AssistantType;

  @IsOptional()
  @IsEnum(AssistantMode)
  primaryMode?: AssistantMode;

  @IsOptional()
  @IsString()
  agentType?: string;

  @IsOptional()
  @IsObject()
  reactConfig?: ReActAgentConfig;

  @IsOptional()
  @IsObject()
  graphConfig?: GraphAgentConfig;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  blocks?: NodeConfig[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  customPrompts?: CustomPrompt[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  contextBlocks?: ContextBlock[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  tools?: AssistantToolConfig[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectExpertise?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateAssistantDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AssistantType)
  type?: AssistantType;

  @IsOptional()
  @IsEnum(AssistantMode)
  primaryMode?: AssistantMode;

  @IsOptional()
  @IsString()
  agentType?: string;

  @IsOptional()
  @IsObject()
  reactConfig?: ReActAgentConfig;

  @IsOptional()
  @IsObject()
  graphConfig?: GraphAgentConfig;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  blocks?: NodeConfig[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  customPrompts?: CustomPrompt[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  contextBlocks?: ContextBlock[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  tools?: AssistantToolConfig[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectExpertise?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class AssistantFiltersDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AssistantType)
  type?: AssistantType;

  @IsOptional()
  @IsString()
  agentType?: string;

  @IsOptional()
  @IsEnum(AssistantStatus)
  status?: AssistantStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}
