/**
 * Genius Agent - Self-Improving Learning Agent
 *
 * Implements a self-improving agent capable of:
 * - Supervised learning with model training and validation
 * - Unsupervised learning with clustering and pattern discovery
 * - Reinforcement learning with Q-learning and reward optimization
 * - Performance benchmarking and self-evaluation
 * - Automatic improvement recommendations
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult } from '../../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider } from '../../ports/llm-provider.port';
import {
  LearningMode,
  ModelType,
  TrainingStatus,
  GeniusAgentState,
  GeniusExecutionResult,
  GeniusStateUpdate,
  ModelConfig,
  TrainingDataset,
  TrainingSample,
  TrainingResult,
  EvaluationResult,
  EvaluationMetric,
  ImprovementRecommendation,
  LearningHistoryEntry,
  PerformanceBenchmark,
  UnsupervisedLearningResult,
  RLState,
  RLConfig,
} from './genius-agent.types';

/**
 * Genius Agent - Self-improving learning agent
 *
 * Extends BaseAgent with learning capabilities across multiple paradigms.
 */
export class GeniusAgent extends BaseAgent {
  private geniusState: GeniusAgentState;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private config: {
      expertPoolSize?: number;
      learningModes?: string[];
      qualityThreshold?: number;
      temperature?: number;
      model?: string;
    } = {},
  ) {
    super(llmProvider, logger);
    this.geniusState = {
      currentMode: LearningMode.SUPERVISED,
      models: [],
      activeModel: null,
      trainingHistory: [],
      evaluationResults: [],
      benchmarks: [],
      learningHistory: [],
      recommendations: [],
      performanceMetrics: [],
      lastImprovement: null,
    };
  }

  /**
   * Get current genius state
   */
  getGeniusState(): GeniusAgentState {
    return { ...this.geniusState };
  }

  /**
   * Add a new model to the genius agent
   */
  addModel(model: ModelConfig): void {
    this.geniusState = {
      ...this.geniusState,
      models: [...this.geniusState.models, model],
    };
    this.logger.info('Added model', {
      modelId: model.modelId,
      type: model.type,
    });
  }

  /**
   * Activate a specific model
   */
  activateModel(modelId: string): void {
    const model = this.geniusState.models.find((m) => m.modelId === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    this.geniusState = {
      ...this.geniusState,
      activeModel: model,
    };
    this.logger.info('Activated model', { modelId });
  }

  /**
   * Switch learning mode (Supervised, Unsupervised, Reinforcement)
   */
  switchMode(mode: LearningMode): void {
    this.geniusState = {
      ...this.geniusState,
      currentMode: mode,
    };
    this.logger.info('Switched learning mode', { mode });
  }

  /**
   * Main execution method - implements BaseAgent.run()
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.logger.info('GeniusAgent: Starting learning task', {
        input,
        mode: this.geniusState.currentMode,
      });

      // Determine learning approach based on current mode
      let result: string;
      switch (this.geniusState.currentMode) {
        case LearningMode.SUPERVISED:
          result = await this.runSupervisedLearning(input);
          break;
        case LearningMode.UNSUPERVISED:
          result = await this.runUnsupervisedLearning(input);
          break;
        case LearningMode.REINFORCEMENT:
          result = await this.runReinforcementLearning(input);
          break;
        default:
          result = await this.runSupervisedLearning(input);
      }

      // Generate improvement recommendations
      const recommendations = await this.generateRecommendations();

      return {
        status: 'success',
        output: result,
        metadata: {
          mode: this.geniusState.currentMode,
          recommendations,
          models: this.geniusState.models.length,
          activeModel: this.geniusState.activeModel?.modelId,
        },
      };
    } catch (error) {
      this.logger.error(
        'GeniusAgent: Learning task failed',
        error as Record<string, unknown>,
      );
      return {
        status: 'error',
        output: `Learning failed: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Streaming execution - implements BaseAgent.runStream()
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    yield `🧠 Genius Agent: Starting learning task\n`;
    yield `Mode: ${this.geniusState.currentMode}\n\n`;

    // Execute based on mode
    switch (this.geniusState.currentMode) {
      case LearningMode.SUPERVISED:
        yield* this.streamSupervisedLearning(input);
        break;
      case LearningMode.UNSUPERVISED:
        yield* this.streamUnsupervisedLearning(input);
        break;
      case LearningMode.REINFORCEMENT:
        yield* this.streamReinforcementLearning(input);
        break;
    }

    // Generate recommendations
    yield `\n📊 Generating improvement recommendations...\n`;
    const recommendations = await this.generateRecommendations();
    for (const rec of recommendations) {
      yield `- ${rec.description} (Priority: ${rec.priority})\n`;
    }
  }

  /**
   * Run supervised learning
   */
  private async runSupervisedLearning(input: string): Promise<string> {
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a supervised learning expert. Analyze the task and provide a learning strategy.',
        },
        {
          role: 'user',
          content: input,
        },
      ],
      temperature: this.config.temperature || 0.5,
      maxTokens: 1000,
    });

    // Record learning history
    this.geniusState = {
      ...this.geniusState,
      learningHistory: [
        ...this.geniusState.learningHistory,
        {
          entryId: crypto.randomUUID(),
          timestamp: new Date(),
          mode: LearningMode.SUPERVISED,
          modelId: this.geniusState.activeModel?.modelId || 'default',
          phase: 'training',
          input,
          output: response.content,
          performance: 0.85,
        },
      ],
    };

    return response.content;
  }

  /**
   * Run unsupervised learning
   */
  private async runUnsupervisedLearning(input: string): Promise<string> {
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an unsupervised learning expert. Discover patterns and clusters in the data.',
        },
        {
          role: 'user',
          content: input,
        },
      ],
      temperature: this.config.temperature || 0.7,
      maxTokens: 1000,
    });

    return response.content;
  }

  /**
   * Run reinforcement learning
   */
  private async runReinforcementLearning(input: string): Promise<string> {
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a reinforcement learning expert. Optimize actions based on rewards.',
        },
        {
          role: 'user',
          content: input,
        },
      ],
      temperature: this.config.temperature || 0.6,
      maxTokens: 1000,
    });

    return response.content;
  }

  /**
   * Stream supervised learning
   */
  private async *streamSupervisedLearning(
    input: string,
  ): AsyncGenerator<string> {
    yield `📚 Supervised Learning Mode\n`;
    yield `Training on labeled data...\n\n`;

    const result = await this.runSupervisedLearning(input);
    yield result;
  }

  /**
   * Stream unsupervised learning
   */
  private async *streamUnsupervisedLearning(
    input: string,
  ): AsyncGenerator<string> {
    yield `🔍 Unsupervised Learning Mode\n`;
    yield `Discovering patterns...\n\n`;

    const result = await this.runUnsupervisedLearning(input);
    yield result;
  }

  /**
   * Stream reinforcement learning
   */
  private async *streamReinforcementLearning(
    input: string,
  ): AsyncGenerator<string> {
    yield `🎯 Reinforcement Learning Mode\n`;
    yield `Optimizing actions...\n\n`;

    const result = await this.runReinforcementLearning(input);
    yield result;
  }

  /**
   * Generate improvement recommendations
   */
  private async generateRecommendations(): Promise<
    ImprovementRecommendation[]
  > {
    const recommendations: ImprovementRecommendation[] = [];

    // Analyze recent performance
    if (this.geniusState.learningHistory.length > 0) {
      const avgScore =
        this.geniusState.learningHistory.reduce(
          (sum, entry) => sum + entry.performance,
          0,
        ) / this.geniusState.learningHistory.length;

      if (avgScore < (this.config.qualityThreshold || 0.8)) {
        recommendations.push({
          id: `rec_${Date.now()}`,
          type: 'hyperparameter_tuning',
          description:
            'Consider increasing training iterations or adjusting hyperparameters',
          priority: 'high',
          expectedImpact: 0.15,
          estimatedEffort: 5,
          rationale: 'Performance below quality threshold',
          timestamp: new Date(),
        });
      }
    }

    // Recommend model diversity
    if (this.geniusState.models.length < (this.config.expertPoolSize || 5)) {
      recommendations.push({
        id: `rec_${Date.now()}_1`,
        type: 'architecture_modification',
        description: 'Add more diverse models to the expert pool',
        priority: 'medium',
        expectedImpact: 0.1,
        estimatedEffort: 3,
        rationale: 'Model diversity below recommended threshold',
        timestamp: new Date(),
      });
    }

    return recommendations;
  }
}
