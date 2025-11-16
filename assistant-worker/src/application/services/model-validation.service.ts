import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';

interface Model {
  name: string;
  provider: string;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
}

@Injectable()
export class ModelValidationService {
  private modelsCache: Model[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  /**
   * Validate that a provider/model combination is available
   */
  async validateModel(
    provider: string,
    model: string,
  ): Promise<{ valid: boolean; error?: string; modelDetails?: Model }> {
    try {
      // Load models if cache is stale
      await this.loadModelsIfNeeded();

      // Find model
      const modelDetails = this.modelsCache.find(
        (m) =>
          m.provider.toLowerCase() === provider.toLowerCase() &&
          (m.name === model || m.name.toLowerCase() === model.toLowerCase()),
      );

      if (!modelDetails) {
        return {
          valid: false,
          error: `Model '${model}' not found for provider '${provider}'. Available models: ${this.getAvailableModelsForProvider(provider).join(', ') || 'none'}`,
        };
      }

      return { valid: true, modelDetails };
    } catch (error) {
      this.logger.error('Model validation failed', {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate token limits for a model
   */
  async validateTokenLimits(
    provider: string,
    model: string,
    requestedTokens: number,
  ): Promise<{ valid: boolean; error?: string; maxTokens?: number }> {
    const validation = await this.validateModel(provider, model);
    if (!validation.valid || !validation.modelDetails) {
      return validation;
    }

    const modelDetails = validation.modelDetails;
    const maxOutputTokens = modelDetails.maxOutputTokens;
    const contextWindow = modelDetails.contextWindow;

    // Check against maxOutputTokens if available
    if (maxOutputTokens && requestedTokens > maxOutputTokens) {
      return {
        valid: false,
        error: `Requested tokens (${requestedTokens}) exceeds model's max output tokens (${maxOutputTokens})`,
        maxTokens: maxOutputTokens,
      };
    }

    // Check against context window if available (requested tokens should be less than context window)
    if (contextWindow && requestedTokens > contextWindow) {
      return {
        valid: false,
        error: `Requested tokens (${requestedTokens}) exceeds model's context window (${contextWindow})`,
        maxTokens: contextWindow,
      };
    }

    return { valid: true, maxTokens: maxOutputTokens || contextWindow };
  }

  /**
   * Get available models for a provider
   */
  getAvailableModelsForProvider(provider: string): string[] {
    return this.modelsCache
      .filter((m) => m.provider.toLowerCase() === provider.toLowerCase())
      .map((m) => m.name);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    return [...new Set(this.modelsCache.map((m) => m.provider))];
  }

  /**
   * Load models from models.json file if cache is stale
   */
  private async loadModelsIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL && this.modelsCache.length > 0) {
      return; // Cache is still valid
    }

    try {
      const fs = await import('fs');
      const path = await import('path');
      const modelsPath = path.join(process.cwd(), 'res', 'models.json');
      if (fs.existsSync(modelsPath)) {
        const data = fs.readFileSync(modelsPath, 'utf-8');
        this.modelsCache = JSON.parse(data) as Model[];
        this.cacheTimestamp = now;
        this.logger.debug(`Loaded ${this.modelsCache.length} models into cache`);
      } else {
        this.logger.warn('models.json not found, using empty cache');
        this.modelsCache = [];
      }
    } catch (error) {
      this.logger.error('Error loading models', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
