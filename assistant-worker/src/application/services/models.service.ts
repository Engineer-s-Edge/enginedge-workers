/**
 * Models Service
 *
 * Provides access to model information from models.json
 * Used by both ModelsController and AssistantsService
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import * as fs from 'fs';
import * as path from 'path';

export interface Model {
  name: string;
  provider: string;
  description?: string;
  category?: string;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  inputCostPer1M?: number | null;
  cachedInputCostPer1M?: number | null;
  outputCostPer1M?: number | null;
  vision?: boolean | null;
  functionCalling?: boolean | null;
  multilingual?: boolean;
  extendedThinking?: boolean;
  knowledgeCutoff?: string | null;
  pricingPerImage?: any;
  pricingPerUse?: any;
}

@Injectable()
export class ModelsService {
  private models: Model[] = [];
  private modelsLoaded = false;

  constructor(@Inject('ILogger') private readonly logger: ILogger) {
    this.loadModels();
  }

  private loadModels() {
    if (this.modelsLoaded) {
      return;
    }

    try {
      const modelsPath = path.join(process.cwd(), 'res', 'models.json');
      if (fs.existsSync(modelsPath)) {
        const data = fs.readFileSync(modelsPath, 'utf-8');
        this.models = JSON.parse(data);
        this.logger.info(
          `Loaded ${this.models.length} models from models.json`,
        );
      } else {
        this.logger.warn('models.json not found, using empty array');
        this.models = [];
      }
      this.modelsLoaded = true;
    } catch (error) {
      this.logger.error(
        `Failed to load models: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.models = [];
      this.modelsLoaded = true;
    }
  }

  /**
   * Get all models
   */
  getAllModels(): Model[] {
    this.loadModels();
    return [...this.models];
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): Model[] {
    this.loadModels();
    return this.models.filter(
      (m) => m.provider.toLowerCase() === provider.toLowerCase(),
    );
  }

  /**
   * Get models by category
   */
  getModelsByCategory(category: string): Model[] {
    this.loadModels();
    return this.models.filter(
      (m) => m.category?.toLowerCase() === category.toLowerCase(),
    );
  }

  /**
   * Get models by cost range
   */
  getModelsByCostRange(
    minCost?: number,
    maxCost?: number,
  ): Model[] {
    this.loadModels();
    return this.models.filter((m) => {
      if (!m.inputCostPer1M && !m.outputCostPer1M) return false;
      const avgCost = (m.inputCostPer1M || 0) + (m.outputCostPer1M || 0) / 2;
      if (minCost !== undefined && avgCost < minCost) return false;
      if (maxCost !== undefined && avgCost > maxCost) return false;
      return true;
    });
  }

  /**
   * Get models with specific capability
   */
  getModelsWithCapability(
    capability:
      | 'vision'
      | 'functionCalling'
      | 'multilingual'
      | 'extendedThinking',
  ): Model[] {
    this.loadModels();
    return this.models.filter((m) => {
      switch (capability) {
        case 'vision':
          return m.vision === true;
        case 'functionCalling':
          return m.functionCalling === true;
        case 'multilingual':
          return m.multilingual === true;
        case 'extendedThinking':
          return m.extendedThinking === true;
        default:
          return false;
      }
    });
  }

  /**
   * Get all providers
   */
  getProviders(): string[] {
    this.loadModels();
    return [...new Set(this.models.map((m) => m.provider))];
  }

  /**
   * Get model by name and provider
   */
  getModel(provider: string, modelName: string): Model | null {
    this.loadModels();
    return (
      this.models.find(
        (m) =>
          m.provider.toLowerCase() === provider.toLowerCase() &&
          (m.name === modelName || m.name.toLowerCase() === modelName.toLowerCase()),
      ) || null
    );
  }
}
