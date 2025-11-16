/**
 * Assistants Service
 *
 * Main application service that coordinates assistant operations
 * Similar to the old AssistantsService but adapted for hexagonal architecture
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { AssistantsCrudService } from './assistants-crud.service';
import { AssistantExecutorService } from './assistant-executor.service';
import {
  CreateAssistantDto,
  UpdateAssistantDto,
  AssistantFiltersDto,
} from '../dto/assistant.dto';
import { ExecuteAssistantDto } from '../dto/execution.dto';
import { Assistant } from '@domain/entities/assistant.entity';
import { ModelsService } from './models.service';

@Injectable()
export class AssistantsService {
  constructor(
    private readonly assistantsCrudService: AssistantsCrudService,
    private readonly assistantExecutorService: AssistantExecutorService,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    private readonly modelsService?: ModelsService,
  ) {
    this.logger.info('AssistantsService initialized');
  }

  // CRUD operations
  async create(createAssistantDto: CreateAssistantDto): Promise<Assistant> {
    return this.assistantsCrudService.create(createAssistantDto);
  }

  async findAll(filters: AssistantFiltersDto = {}): Promise<Assistant[]> {
    return this.assistantsCrudService.findAll(filters);
  }

  async findByName(name: string): Promise<Assistant> {
    return this.assistantsCrudService.findByName(name);
  }

  async update(
    name: string,
    updateAssistantDto: UpdateAssistantDto,
  ): Promise<Assistant> {
    return this.assistantsCrudService.update(name, updateAssistantDto);
  }

  async remove(name: string): Promise<void> {
    return this.assistantsCrudService.remove(name);
  }

  // Execution operations
  async execute(name: string, executeDto: ExecuteAssistantDto): Promise<any> {
    return this.assistantExecutorService.execute(name, executeDto);
  }

  async executeStream(
    name: string,
    executeDto: ExecuteAssistantDto,
  ): Promise<AsyncGenerator<string, void, unknown>> {
    return this.assistantExecutorService.executeStream(name, executeDto);
  }

  // Model information methods
  // These delegate to ModelsService to unify data source
  async getAllModels(): Promise<any[]> {
    if (!this.modelsService) {
      this.logger.warn('ModelsService not available');
      return [];
    }
    return this.modelsService.getAllModels();
  }

  async getModelsByProvider(provider: string): Promise<any[]> {
    if (!this.modelsService) {
      this.logger.warn('ModelsService not available');
      return [];
    }
    return this.modelsService.getModelsByProvider(provider);
  }

  async getModelsByCategory(category: string): Promise<any[]> {
    if (!this.modelsService) {
      this.logger.warn('ModelsService not available');
      return [];
    }
    return this.modelsService.getModelsByCategory(category);
  }

  async getModelsByCostRange(minCost: number, maxCost: number): Promise<any[]> {
    if (!this.modelsService) {
      this.logger.warn('ModelsService not available');
      return [];
    }
    return this.modelsService.getModelsByCostRange(minCost, maxCost);
  }

  async getModelsWithCapability(
    capability:
      | 'vision'
      | 'functionCalling'
      | 'multilingual'
      | 'extendedThinking',
  ): Promise<any[]> {
    if (!this.modelsService) {
      this.logger.warn('ModelsService not available');
      return [];
    }
    return this.modelsService.getModelsWithCapability(capability);
  }

  async findModelsByName(name: string): Promise<any[]> {
    // TODO: Integrate with ModelsController
    return [];
  }

  async getModelDetails(
    providerName: string,
    modelId: string,
  ): Promise<any | null> {
    // TODO: Integrate with ModelsController
    return null;
  }

  async calculateModelCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number = 0,
  ): Promise<{
    inputCost: number;
    outputCost: number;
    totalCost: number;
  } | null> {
    // TODO: Integrate with ModelsController
    return null;
  }

  async getAvailableProviders(): Promise<string[]> {
    // TODO: Integrate with ModelsController
    return [];
  }

  async getModelsWithDetails(providerName?: string): Promise<any[]> {
    // TODO: Integrate with ModelsController
    return [];
  }
}
