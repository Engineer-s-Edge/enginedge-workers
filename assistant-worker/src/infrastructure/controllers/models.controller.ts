import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface Model {
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

@Controller('models')
export class ModelsController {
  private models: Model[] = [];
  private readonly logger: Logger;

  constructor(@Inject('ILogger') logger: Logger) {
    this.logger = logger;
    this.loadModels();
  }

  private loadModels() {
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
    } catch (error) {
      this.logger.error(
        `Failed to load models: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.models = [];
    }
  }

  /**
   * GET /models - List all models
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllModels() {
    try {
      return {
        success: true,
        models: this.models,
        count: this.models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/providers - List providers
   */
  @Get('providers')
  @HttpCode(HttpStatus.OK)
  async getProviders() {
    try {
      const providers = [...new Set(this.models.map((m) => m.provider))];
      return {
        success: true,
        providers,
        count: providers.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        providers: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/provider/:provider - Models by provider
   */
  @Get('provider/:provider')
  @HttpCode(HttpStatus.OK)
  async getModelsByProvider(@Param('provider') provider: string) {
    try {
      const models = this.models.filter(
        (m) => m.provider.toLowerCase() === provider.toLowerCase(),
      );
      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/category/:category - Models by category
   */
  @Get('category/:category')
  @HttpCode(HttpStatus.OK)
  async getModelsByCategory(@Param('category') category: string) {
    try {
      const models = this.models.filter(
        (m) => m.category?.toLowerCase() === category.toLowerCase(),
      );
      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/capability/:capability - Models by capability
   */
  @Get('capability/:capability')
  @HttpCode(HttpStatus.OK)
  async getModelsByCapability(@Param('capability') capability: string) {
    try {
      const models = this.models.filter((m) => {
        switch (capability.toLowerCase()) {
          case 'vision':
            return m.vision === true;
          case 'functioncalling':
          case 'function-calling':
            return m.functionCalling === true;
          case 'multilingual':
            return m.multilingual === true;
          case 'extendedthinking':
          case 'extended-thinking':
            return m.extendedThinking === true;
          default:
            return false;
        }
      });
      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/search - Search models
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchModels(@Query('name') name: string) {
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required',
        models: [],
        count: 0,
      };
    }

    try {
      const query = name.toLowerCase();
      const models = this.models.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query),
      );
      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/cost-range - Filter by cost range
   */
  @Get('cost-range')
  @HttpCode(HttpStatus.OK)
  async getModelsByCostRange(
    @Query('min') minCost?: string,
    @Query('max') maxCost?: string,
  ) {
    try {
      const min = minCost ? parseFloat(minCost) : undefined;
      const max = maxCost ? parseFloat(maxCost) : undefined;

      const models = this.models.filter((m) => {
        if (!m.inputCostPer1M && !m.outputCostPer1M) return false;
        const avgCost = (m.inputCostPer1M || 0) + (m.outputCostPer1M || 0) / 2;
        if (min !== undefined && avgCost < min) return false;
        if (max !== undefined && avgCost > max) return false;
        return true;
      });

      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        models: [],
        count: 0,
      };
    }
  }

  /**
   * GET /models/:provider/:modelId/details - Model details
   */
  @Get(':provider/:modelId/details')
  @HttpCode(HttpStatus.OK)
  async getModelDetails(
    @Param('provider') provider: string,
    @Param('modelId') modelId: string,
  ) {
    try {
      const model = this.models.find(
        (m) =>
          m.provider.toLowerCase() === provider.toLowerCase() &&
          (m.name === modelId ||
            m.name.toLowerCase() === modelId.toLowerCase()),
      );

      if (!model) {
        return {
          success: false,
          error: 'Model not found',
          model: null,
        };
      }

      return {
        success: true,
        model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        model: null,
      };
    }
  }

  /**
   * POST /models/:modelId/calculate-cost - Cost estimation
   */
  @Post(':modelId/calculate-cost')
  @HttpCode(HttpStatus.OK)
  async calculateCost(
    @Param('modelId') modelId: string,
    @Body() body: { inputTokens: number; outputTokens: number },
  ) {
    try {
      const model = this.models.find(
        (m) =>
          m.name === modelId || m.name.toLowerCase() === modelId.toLowerCase(),
      );

      if (!model || !model.inputCostPer1M || !model.outputCostPer1M) {
        return {
          success: false,
          error: `Model ${modelId} not found or pricing information unavailable`,
        };
      }

      const inputCost = (body.inputTokens / 1_000_000) * model.inputCostPer1M;
      const outputCost =
        (body.outputTokens / 1_000_000) * model.outputCostPer1M;
      const totalCost = inputCost + outputCost;

      return {
        success: true,
        modelId,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        inputCost,
        outputCost,
        totalCost,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
