/**
 * Question Selection Service
 * 
 * Domain service for selecting questions based on criteria while preventing repetition.
 * Pure business logic - no external dependencies.
 */

import { InterviewQuestion, QuestionCategory } from '../entities';

export interface QuestionSelectionCriteria {
  category?: QuestionCategory;
  difficulty?: 'easy' | 'medium' | 'hard';
  subcategory?: string;
  tags?: string[];
  excludeQuestionIds?: string[]; // Prevent repetition
  limit?: number;
}

export class QuestionSelectionService {
  /**
   * Select questions matching criteria while avoiding repetition
   */
  selectQuestions(
    availableQuestions: InterviewQuestion[],
    criteria: QuestionSelectionCriteria,
  ): InterviewQuestion[] {
    const {
      category,
      difficulty,
      subcategory,
      tags,
      excludeQuestionIds = [],
      limit,
    } = criteria;

    // Filter questions by criteria
    let filtered = availableQuestions.filter((q) => {
      // Exclude already used questions
      if (excludeQuestionIds.includes(q.questionId)) {
        return false;
      }

      // Filter by category
      if (category && q.category !== category) {
        return false;
      }

      // Filter by difficulty
      if (difficulty && q.difficulty !== difficulty) {
        return false;
      }

      // Filter by subcategory
      if (subcategory && q.subcategory !== subcategory) {
        return false;
      }

      // Filter by tags (at least one must match)
      if (tags && tags.length > 0) {
        const hasMatchingTag = tags.some((tag) => q.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });

    // Shuffle to randomize selection
    filtered = this.shuffleArray(filtered);

    // Apply limit
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * Select questions for multiple phases, ensuring no repetition across phases
   */
  selectQuestionsForPhases(
    availableQuestions: InterviewQuestion[],
    phaseRequirements: Array<{
      category: QuestionCategory;
      difficulty: 'easy' | 'medium' | 'hard';
      count: number;
      subcategory?: string;
      tags?: string[];
    }>,
    previouslyUsedQuestionIds: string[] = [],
  ): Map<number, InterviewQuestion[]> {
    const selectedByPhase = new Map<number, InterviewQuestion[]>();
    const usedQuestionIds = new Set<string>(previouslyUsedQuestionIds);

    phaseRequirements.forEach((req, phaseIndex) => {
      const criteria: QuestionSelectionCriteria = {
        category: req.category,
        difficulty: req.difficulty,
        subcategory: req.subcategory,
        tags: req.tags,
        excludeQuestionIds: Array.from(usedQuestionIds),
        limit: req.count,
      };

      const selected = this.selectQuestions(availableQuestions, criteria);

      // Mark selected questions as used
      selected.forEach((q) => usedQuestionIds.add(q.questionId));

      selectedByPhase.set(phaseIndex, selected);
    });

    return selectedByPhase;
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

