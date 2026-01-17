/**
 * Genius Agent Types - Self-Improving Learning Agent
 *
 * Defines types for supervised learning, unsupervised learning, and reinforcement learning modes.
 * Includes model management, training data, performance metrics, and self-improvement logic.
 */

/**
 * Learning mode enum - Different learning paradigms
 */
export enum LearningMode {
  SUPERVISED = 'SUPERVISED',
  UNSUPERVISED = 'UNSUPERVISED',
  REINFORCEMENT = 'REINFORCEMENT',
}

/**
 * Model type enum - Different model architectures
 */
export enum ModelType {
  NEURAL_NETWORK = 'NEURAL_NETWORK',
  DECISION_TREE = 'DECISION_TREE',
  CLUSTERING = 'CLUSTERING',
  Q_LEARNING = 'Q_LEARNING',
}

/**
 * Training status enum
 */
export enum TrainingStatus {
  IDLE = 'IDLE',
  TRAINING = 'TRAINING',
  VALIDATING = 'VALIDATING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

/**
 * Evaluation metric - Performance measurement
 */
export interface EvaluationMetric {
  readonly name: string;
  readonly value: number;
  readonly timestamp: Date;
  readonly threshold: number;
  readonly unit: string;
}

/**
 * Training sample - Input/output pair for supervised learning
 */
export interface TrainingSample {
  readonly id: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly label?: string;
  readonly weight?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Training dataset
 */
export interface TrainingDataset {
  readonly id: string;
  readonly name: string;
  readonly samples: readonly TrainingSample[];
  readonly totalSamples: number;
  readonly features?: readonly string[];
  readonly labels?: readonly string[];
  readonly createdAt: Date;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  readonly modelId: string;
  readonly type: ModelType;
  readonly name: string;
  readonly version: string;
  readonly hyperparameters: Record<string, unknown>;
  readonly weights?: Record<string, number>;
  readonly architecture?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Training result
 */
export interface TrainingResult {
  readonly modelId: string;
  readonly status: TrainingStatus;
  readonly epoch: number;
  readonly totalEpochs: number;
  readonly loss: number;
  readonly accuracy?: number;
  readonly metrics: readonly EvaluationMetric[];
  readonly trainingDuration: number;
  readonly timestamp: Date;
}

/**
 * Evaluation result - Performance on validation/test set
 */
export interface EvaluationResult {
  readonly modelId: string;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly confusionMatrix: number[][];
  readonly evaluationMetrics: readonly EvaluationMetric[];
  readonly timestamp: Date;
}

/**
 * Performance benchmark - Compare model performance over time
 */
export interface PerformanceBenchmark {
  readonly benchmarkId: string;
  readonly modelId: string;
  readonly metrics: readonly EvaluationMetric[];
  readonly improvement: number;
  readonly trend: 'improving' | 'declining' | 'stable';
  readonly timestamp: Date;
}

/**
 * Learning history entry - Track learning progress
 */
export interface LearningHistoryEntry {
  readonly entryId: string;
  readonly timestamp: Date;
  readonly mode: LearningMode;
  readonly modelId: string;
  readonly phase: 'training' | 'evaluation' | 'improvement';
  readonly input: unknown;
  readonly output: unknown;
  readonly performance: number;
  readonly adjustments?: Record<string, unknown>;
}

/**
 * Improvement recommendation
 */
export interface ImprovementRecommendation {
  readonly id: string;
  readonly type:
    | 'model_change'
    | 'hyperparameter_tuning'
    | 'data_augmentation'
    | 'architecture_modification';
  readonly description: string;
  readonly priority: 'low' | 'medium' | 'high';
  readonly expectedImpact: number;
  readonly estimatedEffort: number;
  readonly rationale: string;
  readonly timestamp: Date;
}

/**
 * Unsupervised learning result - Clustering, dimensionality reduction, etc.
 */
export interface UnsupervisedLearningResult {
  readonly resultId: string;
  readonly clusters?: readonly (readonly unknown[])[];
  readonly centeroids?: readonly unknown[];
  readonly labels?: readonly string[];
  readonly silhouetteScore?: number;
  readonly inertia?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Reinforcement learning state
 */
export interface RLState {
  readonly state: unknown;
  readonly action: unknown;
  readonly reward: number;
  readonly nextState: unknown;
  readonly episode: number;
  readonly stepInEpisode: number;
}

/**
 * Q-learning table entry
 */
export interface QTableEntry {
  readonly stateActionPair: string;
  readonly qValue: number;
  readonly visits: number;
  readonly updatedAt: Date;
}

/**
 * Reinforcement learning configuration
 */
export interface RLConfig {
  readonly learningRate: number;
  readonly discountFactor: number;
  readonly epsilon: number;
  readonly epsilonDecay: number;
  readonly minEpsilon: number;
  readonly episodes: number;
  readonly maxStepsPerEpisode: number;
}

/**
 * Genius Agent state
 */
export interface GeniusAgentState {
  readonly currentMode: LearningMode;
  readonly models: readonly ModelConfig[];
  readonly activeModel: ModelConfig | null;
  readonly trainingHistory: readonly TrainingResult[];
  readonly evaluationResults: readonly EvaluationResult[];
  readonly benchmarks: readonly PerformanceBenchmark[];
  readonly learningHistory: readonly LearningHistoryEntry[];
  readonly recommendations: readonly ImprovementRecommendation[];
  readonly rlState?: RLState;
  readonly qTable?: readonly QTableEntry[];
  readonly performanceMetrics: readonly EvaluationMetric[];
  readonly lastImprovement: Date | null;
}

/**
 * Genius execution result
 */
export interface GeniusExecutionResult {
  readonly geniusId: string;
  readonly status: 'success' | 'partial' | 'failed';
  readonly learningMode: LearningMode;
  readonly output: unknown;
  readonly trainingResult?: TrainingResult;
  readonly evaluationResult?: EvaluationResult;
  readonly improvements: readonly ImprovementRecommendation[];
  readonly performance: number;
  readonly totalDuration: number;
  readonly timestamp: Date;
}

/**
 * Training phase update
 */
export interface GeniusStateUpdate {
  readonly state:
    | 'training'
    | 'evaluating'
    | 'improving'
    | 'complete'
    | 'error';
  readonly agent_id: string;
  readonly mode: LearningMode;
  readonly data: {
    readonly phase: string;
    readonly progress: number;
    readonly currentMetric?: EvaluationMetric;
    readonly trainingResult?: TrainingResult;
    readonly error?: string;
  };
  readonly timestamp: Date;
}
