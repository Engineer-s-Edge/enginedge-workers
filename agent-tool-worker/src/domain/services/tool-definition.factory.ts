import { Injectable } from '@nestjs/common';
import { ToolDefinition } from '../entities/tool.entities';
import { ToolConfig } from '../value-objects/tool-config.value-objects';

@Injectable()
export class ToolDefinitionFactory {
  create(
    name: string,
    description: string,
    config?: Partial<ToolConfig>,
  ): ToolDefinition {
    const base: ToolDefinition = {
      name,
      description,
      version: '1.0.0',
      config: {
        timeoutMs: 30000,
        retry: { maxAttempts: 0, backoffMs: 0 },
        cacheTtlMs: 0,
        ...config,
      },
    };
    return base;
  }
}
