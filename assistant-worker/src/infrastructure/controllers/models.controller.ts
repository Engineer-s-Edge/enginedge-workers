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
import { ModelsService } from '@application/services/models.service';

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
  private readonly logger: Logger;

  constructor(
    @Inject('ILogger') logger: Logger,
    private readonly modelsService: ModelsService,
  ) {
    this.logger = logger;
  }

  /**
   * GET /models - List all models
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllModels() {
    try {
      const models = this.modelsService.getAllModels();
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
   * GET /models/providers - List providers
   */
  @Get('providers')
  @HttpCode(HttpStatus.OK)
  async getProviders() {
    try {
      const providers = this.modelsService.getProviders();
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
      const models = this.modelsService.getModelsByProvider(provider);
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
      const models = this.modelsService.getModelsByCategory(category);
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
      const normalizedCapability = capability.toLowerCase().replace('-', '');
      let models: Model[] = [];

      if (normalizedCapability === 'vision') {
        models = this.modelsService.getModelsWithCapability('vision');
      } else if (
        normalizedCapability === 'functioncalling' ||
        normalizedCapability === 'functioncalling'
      ) {
        models = this.modelsService.getModelsWithCapability('functionCalling');
      } else if (normalizedCapability === 'multilingual') {
        models = this.modelsService.getModelsWithCapability('multilingual');
      } else if (
        normalizedCapability === 'extendedthinking' ||
        normalizedCapability === 'extendedthinking'
      ) {
        models = this.modelsService.getModelsWithCapability('extendedThinking');
      }

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
      const models = this.modelsService
        .getAllModels()
        .filter(
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

      const models = this.modelsService.getModelsByCostRange(min, max);

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
      const model = this.modelsService.getModel(provider, modelId);

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
      // Find model by name across all providers
      const allModels = this.modelsService.getAllModels();
      const model = allModels.find(
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
