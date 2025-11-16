import { Injectable, Inject } from '@nestjs/common';
import { ConversationSettingsOverrides } from '@domain/conversations/conversation.types';
import { ILogger } from '../ports/logger.port';
import { Agent } from '@domain/entities/agent.entity';

/**
 * Service to merge conversation settings overrides with base agent configuration
 */
@Injectable()
export class AgentConfigurationService {
  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  /**
   * Merge conversation settings overrides with base agent configuration
   * Overrides take precedence, but base config provides defaults for missing fields
   */
  mergeSettings(
    baseAgent: Agent,
    overrides?: ConversationSettingsOverrides,
  ): Record<string, unknown> {
    if (!overrides) {
      return this.agentToConfig(baseAgent);
    }

    const baseConfig = this.agentToConfig(baseAgent);
    const merged: Record<string, unknown> = { ...baseConfig };

    // Merge LLM configuration
    if (overrides.llm || overrides.model || overrides.temperature || overrides.maxTokens) {
      merged.llm = {
        ...(baseConfig.llm as Record<string, unknown> || {}),
        ...(overrides.llm || {}),
      };

      // Handle legacy fields
      if (overrides.model && !overrides.llm?.model) {
        (merged.llm as Record<string, unknown>).model = overrides.model;
      }
      if (overrides.temperature !== undefined && overrides.llm?.temperature === undefined) {
        (merged.llm as Record<string, unknown>).temperature = overrides.temperature;
      }
      if (overrides.maxTokens !== undefined && overrides.llm?.maxTokens === undefined) {
        (merged.llm as Record<string, unknown>).maxTokens = overrides.maxTokens;
      }
    }

    // Merge memory configuration
    if (overrides.memories || overrides.memoryType) {
      if (overrides.memories) {
        merged.memories = overrides.memories;
      } else if (overrides.memoryType) {
        // Legacy: convert single memoryType to memories array
        merged.memories = [
          {
            type: overrides.memoryType,
          },
        ];
      }
    }

    // Merge tools configuration
    if (overrides.tools) {
      merged.tools = {
        ...(baseConfig.tools as Record<string, unknown> || {}),
        ...overrides.tools,
      };

      // Handle legacy allowList/denyList
      if (overrides.tools.allowList && !overrides.tools.enabled) {
        (merged.tools as Record<string, unknown>).enabled = overrides.tools.allowList;
      }
      if (overrides.tools.denyList && !overrides.tools.disabled) {
        (merged.tools as Record<string, unknown>).disabled = overrides.tools.denyList;
      }
    }

    // Merge streaming configuration
    if (overrides.streaming) {
      merged.streaming = {
        ...(baseConfig.streaming as Record<string, unknown> || {}),
        ...overrides.streaming,
      };
    }

    // Merge reasoning configuration
    if (overrides.reasoning) {
      merged.reasoning = {
        ...(baseConfig.reasoning as Record<string, unknown> || {}),
        ...overrides.reasoning,
      };

      // Handle legacy steps property
      if (overrides.reasoning.steps !== undefined && overrides.reasoning.maxSteps === undefined) {
        (merged.reasoning as Record<string, unknown>).maxSteps = overrides.reasoning.steps;
      }
    }

    // Merge checkpoints configuration
    if (overrides.checkpoints) {
      merged.checkpoints = {
        ...(baseConfig.checkpoints as Record<string, unknown> || {}),
        ...overrides.checkpoints,
      };
    }

    // Merge custom settings
    if (overrides.custom) {
      merged.custom = {
        ...(baseConfig.custom as Record<string, unknown> || {}),
        ...overrides.custom,
      };
    }

    return merged;
  }

  /**
   * Convert agent to configuration object
   */
  private agentToConfig(agent: Agent): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    // Extract LLM config from agent
    if (agent.config) {
      const agentConfig = agent.config as any;
      if (agentConfig.model || agentConfig.provider) {
        config.llm = {
          provider: agentConfig.provider,
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens,
        };
      }

      // Extract other config
      if (agentConfig.memory) {
        config.memory = agentConfig.memory;
      }
      if (agentConfig.tools) {
        config.tools = agentConfig.tools;
      }
      if (agentConfig.streaming) {
        config.streaming = agentConfig.streaming;
      }
    }

    return config;
  }

  /**
   * Check if streaming is enabled in settings
   */
  isStreamingEnabled(overrides?: ConversationSettingsOverrides): boolean {
    if (!overrides) {
      return false;
    }

    // Check streaming.enabled flag
    if (overrides.streaming?.enabled !== undefined) {
      return overrides.streaming.enabled;
    }

    // If any streaming sub-options are enabled, consider streaming enabled
    return !!(
      overrides.streaming?.streamTokens ||
      overrides.streaming?.streamThoughts ||
      overrides.streaming?.streamToolCalls ||
      overrides.streaming?.streamEvents
    );
  }

  /**
   * Get streaming configuration from settings
   */
  getStreamingConfig(overrides?: ConversationSettingsOverrides): {
    enabled: boolean;
    streamTokens?: boolean;
    streamThoughts?: boolean;
    streamToolCalls?: boolean;
    streamEvents?: boolean;
    bufferSize?: number;
    chunkSize?: number;
  } {
    if (!overrides?.streaming) {
      return { enabled: false };
    }

    return {
      enabled: overrides.streaming.enabled ?? false,
      streamTokens: overrides.streaming.streamTokens,
      streamThoughts: overrides.streaming.streamThoughts,
      streamToolCalls: overrides.streaming.streamToolCalls,
      streamEvents: overrides.streaming.streamEvents,
      bufferSize: overrides.streaming.bufferSize,
      chunkSize: overrides.streaming.chunkSize,
    };
  }
}
