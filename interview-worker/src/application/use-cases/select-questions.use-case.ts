/**
 * Select Questions Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewQuestion, QuestionCategory } from '../../domain/entities';
import { IInterviewQuestionRepository } from '../ports/repositories.port';
import {
  QuestionSelectionService,
  QuestionSelectionCriteria,
} from '../../domain/services/question-selection.service';

export interface SelectQuestionsInput {
  category?: QuestionCategory;
  difficulty?: 'easy' | 'medium' | 'hard';
  subcategory?: string;
  tags?: string[];
  excludeQuestionIds?: string[];
  limit?: number;
}

@Injectable()
export class SelectQuestionsUseCase {
  private readonly selectionService = new QuestionSelectionService();

  constructor(
    @Inject('IInterviewQuestionRepository')
    private readonly questionRepository: IInterviewQuestionRepository,
  ) {}

  async execute(input: SelectQuestionsInput): Promise<InterviewQuestion[]> {
    // Get all available questions
    let questions: InterviewQuestion[] = [];

    if (input.category) {
      // Get questions by category for better performance
      questions = await this.questionRepository.findByCategory(
        input.category,
        input.difficulty,
      );
    } else {
      // Get all questions
      questions = await this.questionRepository.findAll();
    }

    // Filter by tags if provided
    if (input.tags && input.tags.length > 0) {
      const byTags = await this.questionRepository.findByTags(input.tags);
      // Merge and deduplicate
      const questionMap = new Map<string, InterviewQuestion>();
      questions.forEach((q) => questionMap.set(q.questionId, q));
      byTags.forEach((q) => questionMap.set(q.questionId, q));
      questions = Array.from(questionMap.values());
    }

    // Apply selection criteria
    const criteria: QuestionSelectionCriteria = {
      category: input.category,
      difficulty: input.difficulty,
      subcategory: input.subcategory,
      tags: input.tags,
      excludeQuestionIds: input.excludeQuestionIds,
      limit: input.limit,
    };

    return this.selectionService.selectQuestions(questions, criteria);
  }
}
