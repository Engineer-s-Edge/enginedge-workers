/**
 * Assistants Controller
 *
 * Infrastructure layer - HTTP endpoints for assistant operations
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Res,
  UsePipes,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { AssistantsService } from '@application/services/assistants.service';
import {
  CreateAssistantDto,
  UpdateAssistantDto,
  AssistantFiltersDto,
} from '@application/dto/assistant.dto';
import { ExecuteAssistantDto } from '@application/dto/execution.dto';
import { ILogger } from '@application/ports/logger.port';

@Controller('assistants')
export class AssistantsController {
  constructor(
    private readonly assistantsService: AssistantsService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.logger.info('AssistantsController initialized');
  }

  // Map assistant to API response shape
  private mapAssistantResponse(assistant: any) {
    if (!assistant) return assistant;
    const obj = assistant;
    const typeMap: Record<string, string> = {
      react_agent: 'react',
      graph_agent: 'graph',
    };
    const normalizedType = typeMap[obj.type] || obj.type;
    const rc = obj.reactConfig || undefined;
    const settings = rc
      ? {
          intelligence: rc.intelligence || rc.cot
            ? {
                llm: {
                  provider: rc.intelligence?.llm?.provider,
                  model: rc.intelligence?.llm?.model,
                  tokenLimit: rc.intelligence?.llm?.tokenLimit,
                  temperature:
                    (rc as any)?.intelligence?.llm?.temperature ??
                    (rc as any)?.cot?.temperature,
                },
              }
            : undefined,
          memory: rc.memory,
          tools: Array.isArray(rc.tools)
            ? rc.tools
                .map((t: any) =>
                  typeof t === 'string' ? t : t?.toolName ?? t?.name,
                )
                .filter((v: any) => typeof v === 'string')
            : undefined,
        }
      : undefined;

    const { reactConfig: _reactConfig, ...sanitizedObj } = obj;

    return {
      ...sanitizedObj,
      type: normalizedType,
      ...(settings ? { settings } : {}),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(@Body() createAssistantDto: CreateAssistantDto) {
    this.logger.info(`Creating assistant: ${createAssistantDto.name}`);
    try {
      const assistant = await this.assistantsService.create(createAssistantDto);
      this.logger.info(`Successfully created assistant: ${assistant.name}`);
      return {
        success: true,
        message: `Assistant '${assistant.name}' created successfully`,
        assistant: this.mapAssistantResponse(assistant),
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to create assistant: ${createAssistantDto.name}`,
        e.message,
      );
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Get()
  async findAll(@Query() filters: AssistantFiltersDto) {
    try {
      const assistants = (await this.assistantsService.findAll(filters)).map(
        (a: any) => this.mapAssistantResponse(a),
      );
      return {
        success: true,
        assistants,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        assistants: [],
      };
    }
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    try {
      const assistant = this.mapAssistantResponse(
        await this.assistantsService.findByName(name),
      );
      return {
        success: true,
        assistant,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Put(':name')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('name') name: string,
    @Body() updateAssistantDto: UpdateAssistantDto,
  ) {
    try {
      const assistant = this.mapAssistantResponse(
        await this.assistantsService.update(name, updateAssistantDto),
      );
      return {
        success: true,
        message: `Assistant '${name}' updated successfully`,
        assistant,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Delete(':name')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('name') name: string) {
    try {
      await this.assistantsService.remove(name);
      return {
        success: true,
        message: `Assistant '${name}' deleted successfully`,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Post(':name/execute')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async execute(
    @Param('name') name: string,
    @Body() executeDto: ExecuteAssistantDto,
  ) {
    this.logger.info(`Executing assistant: ${name} for user: ${executeDto.userId}`);
    try {
      const result = await this.assistantsService.execute(name, executeDto);
      this.logger.info(`Successfully executed assistant: ${name}`);
      return {
        success: !!result?.success,
        ...result,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to execute assistant: ${name}`, e.message);
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Post(':name/execute/stream')
  @UsePipes(new ValidationPipe({ transform: true }))
  async executeStream(
    @Param('name') name: string,
    @Body() executeDto: ExecuteAssistantDto,
    @Res() response: Response,
  ): Promise<void> {
    this.logger.info(
      `Streaming execution for assistant: ${name}, user: ${executeDto.userId}`,
    );

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      const stream = await this.assistantsService.executeStream(
        name,
        executeDto,
      );

      let _chunkCount = 0;
      const _startTime = Date.now();

      for await (const chunk of stream) {
        _chunkCount++;
        const _elapsedMs = Date.now() - _startTime;

        // Send SSE formatted message
        const sseMessage = `data: ${JSON.stringify({ chunk, type: 'chunk' })}\n\n`;
        response.write(sseMessage);

        // Force flush
        if (typeof (response as any).flush === 'function') {
          (response as any).flush();
        }
      }

      const _totalTime = Date.now() - _startTime;

      // Send completion message
      response.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      response.end();

      this.logger.info(`Completed streaming for assistant: ${name}`);
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to stream assistant: ${name}`, e.message);
      response.write(
        `data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`,
      );
      response.end();
    }
  }

  // Model information endpoints - delegate to ModelsController logic
  @Get('models')
  async getAllModels() {
    try {
      const models = await this.assistantsService.getAllModels();
      return {
        success: true,
        models,
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        count: 0,
      };
    }
  }

  @Get('models/providers')
  async getAvailableProviders() {
    try {
      const providers = await this.assistantsService.getAvailableProviders();
      return {
        success: true,
        providers,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        providers: [],
      };
    }
  }

  @Get('models/provider/:provider')
  async getModelsByProvider(@Param('provider') provider: string) {
    try {
      const models = await this.assistantsService.getModelsByProvider(provider);
      return {
        success: true,
        models,
        provider,
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        provider,
        count: 0,
      };
    }
  }

  @Get('models/category/:category')
  async getModelsByCategory(@Param('category') category: string) {
    try {
      const models = await this.assistantsService.getModelsByCategory(category);
      return {
        success: true,
        models,
        category,
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        category,
        count: 0,
      };
    }
  }

  @Get('models/capability/:capability')
  async getModelsWithCapability(@Param('capability') capability: string) {
    try {
      const validCapabilities = [
        'vision',
        'functionCalling',
        'multilingual',
        'extendedThinking',
      ];
      if (!validCapabilities.includes(capability)) {
        return {
          success: false,
          error: `Invalid capability. Must be one of: ${validCapabilities.join(', ')}`,
          models: [],
          capability,
          count: 0,
        };
      }

      const models = await this.assistantsService.getModelsWithCapability(
        capability as any,
      );
      return {
        success: true,
        models,
        capability,
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        capability,
        count: 0,
      };
    }
  }

  @Get('models/search')
  async searchModels(@Query('name') name: string) {
    try {
      if (!name) {
        return {
          success: false,
          error: 'Name parameter is required',
          models: [],
          count: 0,
        };
      }

      const models = await this.assistantsService.findModelsByName(name);
      return {
        success: true,
        models,
        searchTerm: name,
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        searchTerm: name,
        count: 0,
      };
    }
  }

  @Get('models/cost-range')
  async getModelsByCostRange(
    @Query('minCost') minCost: string,
    @Query('maxCost') maxCost: string,
  ) {
    try {
      const min = parseFloat(minCost);
      const max = parseFloat(maxCost);

      if (isNaN(min) || isNaN(max)) {
        return {
          success: false,
          error: 'minCost and maxCost must be valid numbers',
          models: [],
          count: 0,
        };
      }

      if (min > max) {
        return {
          success: false,
          error: 'minCost must be less than or equal to maxCost',
          models: [],
          count: 0,
        };
      }

      const models = await this.assistantsService.getModelsByCostRange(
        min,
        max,
      );
      return {
        success: true,
        models,
        costRange: { min, max },
        count: models.length,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        models: [],
        count: 0,
      };
    }
  }

  @Get('models/:provider/:modelId/details')
  async getModelDetails(
    @Param('provider') provider: string,
    @Param('modelId') modelId: string,
  ) {
    try {
      const modelDetails = await this.assistantsService.getModelDetails(
        provider,
        modelId,
      );

      if (!modelDetails) {
        return {
          success: false,
          error: `Model '${modelId}' not found for provider '${provider}'`,
          modelDetails: null,
        };
      }

      return {
        success: true,
        modelDetails,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        modelDetails: null,
      };
    }
  }

  @Post('models/:modelId/calculate-cost')
  async calculateModelCost(
    @Param('modelId') modelId: string,
    @Body() body: { inputTokens: number; outputTokens?: number },
  ) {
    try {
      const { inputTokens, outputTokens = 0 } = body;

      if (typeof inputTokens !== 'number' || inputTokens < 0) {
        return {
          success: false,
          error: 'inputTokens must be a non-negative number',
          cost: null,
        };
      }

      if (typeof outputTokens !== 'number' || outputTokens < 0) {
        return {
          success: false,
          error: 'outputTokens must be a non-negative number',
          cost: null,
        };
      }

      const cost = await this.assistantsService.calculateModelCost(
        modelId,
        inputTokens,
        outputTokens,
      );

      if (!cost) {
        return {
          success: false,
          error: `Could not calculate cost for model '${modelId}' - model not found or pricing incomplete`,
          cost: null,
        };
      }

      return {
        success: true,
        cost,
        modelId,
        tokens: { input: inputTokens, output: outputTokens },
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
        cost: null,
      };
    }
  }

  // Frontend compatibility route
  @Post('query')
  @UsePipes(new ValidationPipe({ transform: true }))
  async query(@Body() body: any) {
    try {
      const {
        query,
        assistantType: _assistantType = 'basic',
        outputFormat: _outputFormat = 'text',
        sessionId,
        llmSettings = {},
        messageHistory = [],
        assistantName,
      } = body;

      if (!query) {
        return {
          success: false,
          error: 'Query is required',
        };
      }

      if (!assistantName) {
        return {
          success: false,
          error: 'assistantName is required to route the query',
        };
      }

      const assistant = await this.assistantsService.findByName(assistantName);

      // Create execution DTO
      const executeDto: ExecuteAssistantDto = {
        input: query,
        conversationId: sessionId,
        options: {
          llmProvider: llmSettings.provider,
          llmModel: llmSettings.model,
          temperature: llmSettings.temperature || 0.7,
          streaming: false,
          history: messageHistory as any,
        },
      };

      const result = await this.assistantsService.execute(
        assistant.name,
        executeDto,
      );

      return {
        success: true,
        result: result.result || result.content || result,
        sessionId: sessionId || result.sessionId,
        assistant: assistant.name,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: e.message,
      };
    }
  }
}
