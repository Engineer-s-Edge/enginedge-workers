/**
 * Agent Configuration Service
 * 
 * Manages agent configurations, defaults, and config merging.
 */

import { Injectable } from '@nestjs/common';

export interface AgentConfig {
  name: string;
  type: string;
  userId: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  memory?: Record<string, unknown>;
  tools?: string[];
  [key: string]: unknown;
}

/**
 * Service for managing agent configurations
 */
@Injectable()
export class AgentConfigurationService {
  /**
   * Create default configuration for agent type
   */
  createDefaultConfig(type: string): Partial<AgentConfig> {
    const base = {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 2000,
    };

    switch (type) {
      case 'react':
        return {
          ...base,
          systemPrompt: 'You are a helpful AI agent that uses tools to accomplish tasks.',
          maxIterations: 10,
          tools: [],
        };

      case 'graph':
        return {
          ...base,
          systemPrompt: 'You are a workflow execution agent.',
          workflow: { nodes: [], edges: [] },
        };

      case 'expert':
        return {
          ...base,
          systemPrompt: 'You are an expert research agent that conducts thorough investigations.',
          maxSources: 10,
          researchDepth: 'medium',
        };

      case 'genius':
        return {
          ...base,
          systemPrompt: 'You are a learning agent that improves over time.',
          learningMode: 'user-directed',
          expertPoolSize: 5,
        };

      case 'collective':
        return {
          ...base,
          systemPrompt: 'You are a project manager coordinating multiple agents.',
          maxAgents: 10,
          coordinationStrategy: 'hierarchical',
        };

      case 'manager':
        return {
          ...base,
          systemPrompt: 'You are a task decomposition agent.',
          decompositionStrategy: 'functional',
          maxSubAgents: 5,
        };

      default:
        return base;
    }
  }

  /**
   * Merge configurations (user config overrides defaults)
   */
  mergeConfigs(defaultConfig: Partial<AgentConfig>, userConfig?: Partial<AgentConfig>): AgentConfig {
    if (!userConfig) {
      return defaultConfig as AgentConfig;
    }

    // Deep merge with user config taking precedence
    const merged = { ...defaultConfig };

    for (const key in userConfig) {
      if (userConfig[key] !== undefined) {
        if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
          // Deep merge objects
          merged[key] = {
            ...(merged[key] as object || {}),
            ...(userConfig[key] as object),
          };
        } else {
          // Replace primitives and arrays
          merged[key] = userConfig[key];
        }
      }
    }

    return merged as AgentConfig;
  }

  /**
   * Validate configuration completeness
   */
  validateConfiguration(config: Partial<AgentConfig>): { valid: boolean; missing: string[] } {
    const required = ['name', 'type', 'userId'];
    const missing: string[] = [];

    for (const field of required) {
      if (!config[field]) {
        missing.push(field);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Update configuration with new values
   */
  updateConfig(
    existingConfig: AgentConfig,
    updates: Partial<AgentConfig>,
  ): AgentConfig {
    return this.mergeConfigs(existingConfig, updates);
  }

  /**
   * Extract configuration for serialization
   */
  toPlainObject(config: AgentConfig): Record<string, unknown> {
    return { ...config };
  }

  /**
   * Create configuration from plain object
   */
  fromPlainObject(obj: Record<string, unknown>): AgentConfig {
    return obj as AgentConfig;
  }
}

