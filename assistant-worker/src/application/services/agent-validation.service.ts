/**
 * Agent Validation Service
 *
 * Validates agent configurations, options, and requests.
 */

import { Injectable } from '@nestjs/common';

export interface AgentOptions {
  name: string;
  type: 'react' | 'graph' | 'expert' | 'genius' | 'collective' | 'manager';
  userId: string;
  config?: Record<string, unknown>;
}

/**
 * Service for validating agent configurations
 */
@Injectable()
export class AgentValidationService {
  /**
   * Validate agent options before creation
   */
  validateAgentOptions(options: AgentOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!options.name || options.name.trim().length === 0) {
      errors.push('Agent name is required');
    }

    if (options.name && options.name.length > 100) {
      errors.push('Agent name must be less than 100 characters');
    }

    if (!options.type) {
      errors.push('Agent type is required');
    }

    const validTypes = [
      'react',
      'graph',
      'expert',
      'genius',
      'collective',
      'manager',
    ];
    if (options.type && !validTypes.includes(options.type)) {
      errors.push(
        `Invalid agent type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    if (!options.userId || options.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate agent configuration by type
   */
  validateAgentConfigByType(
    type: string,
    config: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (type) {
      case 'react':
        this.validateReActConfig(config, errors);
        break;
      case 'graph':
        this.validateGraphConfig(config, errors);
        break;
      case 'expert':
        this.validateExpertConfig(config, errors);
        break;
      case 'genius':
        this.validateGeniusConfig(config, errors);
        break;
      case 'collective':
        this.validateCollectiveConfig(config, errors);
        break;
      case 'manager':
        this.validateManagerConfig(config, errors);
        break;
      default:
        errors.push(`Unknown agent type: ${type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate tool calls
   */
  validateToolCalls(toolCalls: unknown[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(toolCalls)) {
      errors.push('Tool calls must be an array');
      return { valid: false, errors };
    }

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i] as any;

      if (!call.name) {
        errors.push(`Tool call ${i}: name is required`);
      }

      if (typeof call.name !== 'string') {
        errors.push(`Tool call ${i}: name must be a string`);
      }

      if (call.arguments && typeof call.arguments !== 'object') {
        errors.push(`Tool call ${i}: arguments must be an object`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate memory configuration
   */
  validateMemoryConfig(memoryConfig: unknown): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!memoryConfig || typeof memoryConfig !== 'object') {
      return { valid: true, errors }; // Memory config is optional
    }

    const config = memoryConfig as any;

    if (config.type) {
      const validTypes = [
        'buffer',
        'window',
        'summary',
        'vector',
        'entity',
        'graph',
      ];
      if (!validTypes.includes(config.type)) {
        errors.push(
          `Invalid memory type. Must be one of: ${validTypes.join(', ')}`,
        );
      }
    }

    if (
      config.maxMessages &&
      (typeof config.maxMessages !== 'number' || config.maxMessages < 1)
    ) {
      errors.push('maxMessages must be a positive number');
    }

    if (
      config.maxTokens &&
      (typeof config.maxTokens !== 'number' || config.maxTokens < 1)
    ) {
      errors.push('maxTokens must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Private validation methods for each agent type

  private validateReActConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (config.maxIterations && typeof config.maxIterations !== 'number') {
      errors.push('ReAct agent: maxIterations must be a number');
    }

    if (config.maxIterations && (config.maxIterations as number) < 1) {
      errors.push('ReAct agent: maxIterations must be at least 1');
    }

    if (config.maxIterations && (config.maxIterations as number) > 20) {
      errors.push('ReAct agent: maxIterations cannot exceed 20');
    }
  }

  private validateGraphConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (config.workflow && typeof config.workflow !== 'object') {
      errors.push('Graph agent: workflow must be an object');
    }

    if (config.workflow) {
      const workflow = config.workflow as any;

      if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        errors.push('Graph agent: workflow must have a nodes array');
      }

      if (!workflow.edges || !Array.isArray(workflow.edges)) {
        errors.push('Graph agent: workflow must have an edges array');
      }
    }
  }

  private validateExpertConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (config.maxSources && typeof config.maxSources !== 'number') {
      errors.push('Expert agent: maxSources must be a number');
    }

    if (
      config.researchDepth &&
      !['shallow', 'medium', 'deep'].includes(config.researchDepth as string)
    ) {
      errors.push(
        'Expert agent: researchDepth must be shallow, medium, or deep',
      );
    }
  }

  private validateGeniusConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (
      config.learningMode &&
      !['user-directed', 'autonomous', 'scheduled'].includes(
        config.learningMode as string,
      )
    ) {
      errors.push(
        'Genius agent: learningMode must be user-directed, autonomous, or scheduled',
      );
    }

    if (config.expertPoolSize && typeof config.expertPoolSize !== 'number') {
      errors.push('Genius agent: expertPoolSize must be a number');
    }
  }

  private validateCollectiveConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (config.maxAgents && typeof config.maxAgents !== 'number') {
      errors.push('Collective agent: maxAgents must be a number');
    }

    if (
      config.coordinationStrategy &&
      !['sequential', 'parallel', 'hierarchical'].includes(
        config.coordinationStrategy as string,
      )
    ) {
      errors.push(
        'Collective agent: coordinationStrategy must be sequential, parallel, or hierarchical',
      );
    }
  }

  private validateManagerConfig(
    config: Record<string, unknown>,
    errors: string[],
  ): void {
    if (
      config.decompositionStrategy &&
      !['functional', 'hierarchical', 'temporal'].includes(
        config.decompositionStrategy as string,
      )
    ) {
      errors.push(
        'Manager agent: decompositionStrategy must be functional, hierarchical, or temporal',
      );
    }

    if (config.maxSubAgents && typeof config.maxSubAgents !== 'number') {
      errors.push('Manager agent: maxSubAgents must be a number');
    }
  }
}
