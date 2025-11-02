/**
 * Question Service
 * 
 * Application service for managing questions.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewQuestion, QuestionCategory } from '../../domain/entities';
import { IInterviewQuestionRepository } from '../ports/repositories.port';
import { CreateQuestionUseCase } from '../use-cases/create-question.use-case';
import { SelectQuestionsUseCase } from '../use-cases/select-questions.use-case';

@Injectable()
export class QuestionService {
  constructor(
    @Inject('IInterviewQuestionRepository')
    private readonly questionRepository: IInterviewQuestionRepository,
    private readonly createQuestionUseCase: CreateQuestionUseCase,
    private readonly selectQuestionsUseCase: SelectQuestionsUseCase,
  ) {}

  async createQuestion(
    questionId: string,
    category: QuestionCategory,
    difficulty: 'easy' | 'medium' | 'hard',
    question: string,
    options?: {
      subcategory?: string;
      tags?: string[];
      expectedDuration?: number;
    },
  ): Promise<InterviewQuestion> {
    return await this.createQuestionUseCase.execute({
      questionId,
      category,
      difficulty,
      question,
      ...options,
    });
  }

  async getQuestion(questionId: string): Promise<InterviewQuestion | null> {
    return await this.questionRepository.findById(questionId);
  }

  async getAllQuestions(): Promise<InterviewQuestion[]> {
    return await this.questionRepository.findAll();
  }

  async getQuestionsByCategory(
    category: QuestionCategory,
    difficulty?: 'easy' | 'medium' | 'hard',
  ): Promise<InterviewQuestion[]> {
    return await this.questionRepository.findByCategory(
      category,
      difficulty,
    );
  }

  async selectQuestions(input: {
    category?: QuestionCategory;
    difficulty?: 'easy' | 'medium' | 'hard';
    subcategory?: string;
    tags?: string[];
    excludeQuestionIds?: string[];
    limit?: number;
  }): Promise<InterviewQuestion[]> {
    return await this.selectQuestionsUseCase.execute(input);
  }

  async updateQuestion(
    questionId: string,
    updates: Partial<InterviewQuestion>,
  ): Promise<InterviewQuestion | null> {
    return await this.questionRepository.update(questionId, updates);
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    return await this.questionRepository.delete(questionId);
  }
}

