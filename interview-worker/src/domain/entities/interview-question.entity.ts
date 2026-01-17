/**
 * InterviewQuestion Entity
 *
 * Represents a question in the question bank that can be used in interviews.
 * Questions are tagged by category, difficulty, and subcategory for selection.
 */

export type QuestionCategory =
  | 'tech-trivia'
  | 'system-design'
  | 'behavioral'
  | 'coding';

export class InterviewQuestion {
  questionId: string;
  category: QuestionCategory;
  subcategory?: string; // e.g., "arrays", "conflict-resolution", "dynamic-programming"
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[]; // Additional tags for filtering
  question: string; // The actual question text
  expectedDuration?: number; // minutes
  starterCode?: string; // Starter code template for coding questions
  correctWorkingCode?: string; // Correct solution for test case validation
  usageCount: number; // How many times this question has been used
  lastUsedAt?: Date; // When this question was last used
  createdAt: Date; // When this question was created
  updatedAt: Date; // When this question was last updated

  constructor(data: {
    questionId: string;
    category: QuestionCategory;
    subcategory?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags?: string[];
    question: string;
    expectedDuration?: number;
    starterCode?: string;
    correctWorkingCode?: string;
    usageCount?: number;
    lastUsedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.questionId = data.questionId;
    this.category = data.category;
    this.subcategory = data.subcategory;
    this.difficulty = data.difficulty;
    this.tags = data.tags || [];
    this.question = data.question;
    this.expectedDuration = data.expectedDuration;
    this.starterCode = data.starterCode;
    this.correctWorkingCode = data.correctWorkingCode;
    this.usageCount = data.usageCount || 0;
    this.lastUsedAt = data.lastUsedAt;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Check if question matches given criteria
   */
  matches(
    category?: QuestionCategory,
    difficulty?: 'easy' | 'medium' | 'hard',
    subcategory?: string,
    tags?: string[],
  ): boolean {
    if (category && this.category !== category) return false;
    if (difficulty && this.difficulty !== difficulty) return false;
    if (subcategory && this.subcategory !== subcategory) return false;
    if (tags && tags.length > 0) {
      const hasMatchingTag = tags.some((tag) => this.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }
    return true;
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      questionId: this.questionId,
      category: this.category,
      subcategory: this.subcategory,
      difficulty: this.difficulty,
      tags: this.tags,
      question: this.question,
      expectedDuration: this.expectedDuration,
      starterCode: this.starterCode,
      correctWorkingCode: this.correctWorkingCode,
      usageCount: this.usageCount,
      lastUsedAt: this.lastUsedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): InterviewQuestion {
    return new InterviewQuestion({
      questionId: data.questionId as string,
      category: data.category as QuestionCategory,
      subcategory: data.subcategory as string | undefined,
      difficulty: data.difficulty as 'easy' | 'medium' | 'hard',
      tags: (data.tags as string[]) || [],
      question: data.question as string,
      expectedDuration: data.expectedDuration as number | undefined,
      starterCode: data.starterCode as string | undefined,
      correctWorkingCode: data.correctWorkingCode as string | undefined,
      usageCount: (data.usageCount as number) || 0,
      lastUsedAt: data.lastUsedAt
        ? new Date(data.lastUsedAt as string)
        : undefined,
      createdAt: data.createdAt
        ? new Date(data.createdAt as string)
        : new Date(),
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt as string)
        : new Date(),
    });
  }
}
