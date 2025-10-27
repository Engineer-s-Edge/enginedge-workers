/**
 * Agent Configuration Value Object
 * 
 * Immutable configuration for an agent
 * Contains LLM settings, behavior parameters, etc.
 */

export interface AgentConfigProps {
  model: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enableTools?: boolean;
  toolNames?: string[];
  streamingEnabled?: boolean;
  timeout?: number;
}

export class AgentConfig {
  private constructor(
    public readonly model: string,
    public readonly provider: string,
    public readonly temperature: number,
    public readonly maxTokens: number,
    public readonly systemPrompt: string,
    public readonly enableTools: boolean,
    public readonly toolNames: readonly string[],
    public readonly streamingEnabled: boolean,
    public readonly timeout: number,
  ) {}

  /**
   * Create with defaults
   */
  static create(props: AgentConfigProps): AgentConfig {
    // Validation
    if (!props.model || props.model.trim().length === 0) {
      throw new Error('Model name is required');
    }

    if (props.temperature !== undefined && (props.temperature < 0 || props.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2');
    }

    if (props.maxTokens !== undefined && props.maxTokens < 1) {
      throw new Error('Max tokens must be positive');
    }

    if (props.timeout !== undefined && props.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }

    return new AgentConfig(
      props.model.trim(),
      props.provider || 'openai',
      props.temperature ?? 0.7,
      props.maxTokens ?? 2000,
      props.systemPrompt || 'You are a helpful AI assistant.',
      props.enableTools ?? false,
      props.toolNames || [],
      props.streamingEnabled ?? false,
      props.timeout ?? 30000,
    );
  }

  /**
   * Create default configuration
   */
  static default(): AgentConfig {
    return AgentConfig.create({
      model: 'gpt-4',
      provider: 'openai',
    });
  }

  /**
   * Update configuration (returns new instance)
   */
  update(updates: Partial<AgentConfigProps>): AgentConfig {
    return AgentConfig.create({
      model: updates.model ?? this.model,
      provider: updates.provider ?? this.provider,
      temperature: updates.temperature ?? this.temperature,
      maxTokens: updates.maxTokens ?? this.maxTokens,
      systemPrompt: updates.systemPrompt ?? this.systemPrompt,
      enableTools: updates.enableTools ?? this.enableTools,
      toolNames: updates.toolNames ?? [...this.toolNames],
      streamingEnabled: updates.streamingEnabled ?? this.streamingEnabled,
      timeout: updates.timeout ?? this.timeout,
    });
  }

  /**
   * Check if tools are enabled
   */
  hasToolsEnabled(): boolean {
    return this.enableTools && this.toolNames.length > 0;
  }

  /**
   * Check if streaming is enabled
   */
  hasStreamingEnabled(): boolean {
    return this.streamingEnabled;
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): Record<string, unknown> {
    return {
      model: this.model,
      provider: this.provider,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      systemPrompt: this.systemPrompt,
      enableTools: this.enableTools,
      toolNames: [...this.toolNames],
      streamingEnabled: this.streamingEnabled,
      timeout: this.timeout,
    };
  }
}
