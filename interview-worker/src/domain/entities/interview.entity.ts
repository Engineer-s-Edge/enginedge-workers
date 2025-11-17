/**
 * Interview Entity
 *
 * Represents an interview template/configuration that can be reused across multiple sessions.
 * This is the configuration that defines what questions will be asked and how the interview flows.
 */

export interface InterviewPhase {
  phaseId: string;
  type: 'behavioral' | 'technical' | 'coding' | 'system-design';
  duration: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  tags?: string[]; // Tags for question filtering (e.g., ["array", "DP", "graphs"] for coding)
  promptOverride?: string; // Custom prompt
  config?: {
    allowPause?: boolean;
    allowSkip?: boolean;
    maxFollowupsPerQuestion?: number;
  };
}

export interface InterviewConfig {
  allowPause: boolean;
  maxPauseDuration: number | null; // null = unlimited
  allowSkip: boolean;
  maxSkips?: number | null; // null = unlimited
  totalTimeLimit: number; // minutes - total interview time limit
}

export interface ScoringRubric {
  overall: {
    weights: {
      behavioral?: number;
      technical?: number;
      coding?: number;
      systemDesign?: number;
    };
  };
  byPhase?: Record<
    string,
    {
      criteria: string[];
      weights?: Record<string, number>;
    }
  >;
}

export class Interview {
  id: string;
  userId: string; // Owner of the template
  title: string;
  description?: string;
  phases: InterviewPhase[];
  config: InterviewConfig;
  rubric: ScoringRubric;
  visibility: 'private' | 'public' | 'unlisted'; // Template visibility
  publishedAt?: Date; // When template was published
  usageCount: number; // How many times used
  favoriteCount: number; // How many users favorited
  createdAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    userId: string;
    title: string;
    description?: string;
    phases: InterviewPhase[];
    config: InterviewConfig;
    rubric: ScoringRubric;
    visibility?: 'private' | 'public' | 'unlisted';
    publishedAt?: Date;
    usageCount?: number;
    favoriteCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.title = data.title;
    this.description = data.description;
    this.phases = data.phases;
    this.config = data.config;
    this.rubric = data.rubric;
    this.visibility = data.visibility || 'private';
    this.publishedAt = data.publishedAt;
    this.usageCount = data.usageCount || 0;
    this.favoriteCount = data.favoriteCount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Get total time limit for the interview
   */
  getTotalTimeLimit(): number {
    return this.config.totalTimeLimit;
  }

  /**
   * Get time limit for a specific phase
   */
  getPhaseTimeLimit(phaseIndex: number): number {
    return this.phases[phaseIndex]?.duration || 0;
  }

  /**
   * Get total number of questions across all phases
   */
  getTotalQuestionCount(): number {
    return this.phases.reduce((total, phase) => total + phase.questionCount, 0);
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      phases: this.phases,
      config: this.config,
      rubric: this.rubric,
      visibility: this.visibility,
      publishedAt: this.publishedAt,
      usageCount: this.usageCount,
      favoriteCount: this.favoriteCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): Interview {
    return new Interview({
      id: data.id as string,
      userId: data.userId as string,
      title: data.title as string,
      description: data.description as string | undefined,
      phases: data.phases as InterviewPhase[],
      config: data.config as InterviewConfig,
      rubric: data.rubric as ScoringRubric,
      visibility: (data.visibility as 'private' | 'public' | 'unlisted') || 'private',
      publishedAt: data.publishedAt
        ? new Date(data.publishedAt as string)
        : undefined,
      usageCount: (data.usageCount as number) || 0,
      favoriteCount: (data.favoriteCount as number) || 0,
      createdAt: data.createdAt
        ? new Date(data.createdAt as string)
        : new Date(),
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt as string)
        : new Date(),
    });
  }
}
