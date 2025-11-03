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

  constructor(data: {
    questionId: string;
    category: QuestionCategory;
    subcategory?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags?: string[];
    question: string;
    expectedDuration?: number;
  }) {
    this.questionId = data.questionId;
    this.category = data.category;
    this.subcategory = data.subcategory;
    this.difficulty = data.difficulty;
    this.tags = data.tags || [];
    this.question = data.question;
    this.expectedDuration = data.expectedDuration;
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
    });
  }
}
