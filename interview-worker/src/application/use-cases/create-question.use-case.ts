/**
 * Create Question Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewQuestion } from '../../domain/entities';
import { IInterviewQuestionRepository } from '../ports/repositories.port';

export interface CreateQuestionInput {
  questionId: string;
  category: 'tech-trivia' | 'system-design' | 'behavioral' | 'coding';
  subcategory?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
  question: string;
  expectedDuration?: number;
  starterCode?: string;
  correctWorkingCode?: string;
}

@Injectable()
export class CreateQuestionUseCase {
  constructor(
    @Inject('IInterviewQuestionRepository')
    private readonly questionRepository: IInterviewQuestionRepository,
  ) {}

  async execute(input: CreateQuestionInput): Promise<InterviewQuestion> {
    const question = new InterviewQuestion({
      questionId: input.questionId,
      category: input.category,
      subcategory: input.subcategory,
      difficulty: input.difficulty,
      tags: input.tags || [],
      question: input.question,
      expectedDuration: input.expectedDuration,
      starterCode: input.starterCode,
      correctWorkingCode: input.correctWorkingCode,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.questionRepository.save(question);
  }
}
