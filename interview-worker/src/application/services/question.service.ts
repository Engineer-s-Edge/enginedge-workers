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
      starterCode?: string;
      correctWorkingCode?: string;
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

  async trackQuestionUsage(questionId: string): Promise<void> {
    const question = await this.questionRepository.findById(questionId);
    if (question) {
      await this.questionRepository.update(questionId, {
        usageCount: (question.usageCount || 0) + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      });
    }
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
    return await this.questionRepository.findByCategory(category, difficulty);
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

  async getQuestionStatistics(questionId: string): Promise<{
    questionId: string;
    usageCount: number;
    lastUsedAt?: Date;
    averageScore?: number;
    successRate?: number;
    usageTrend?: Array<{ date: string; count: number }>;
  }> {
    const question = await this.questionRepository.findById(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Basic statistics from question entity
    const stats = {
      questionId: question.questionId,
      usageCount: question.usageCount || 0,
      lastUsedAt: question.lastUsedAt,
      averageScore: undefined as number | undefined,
      successRate: undefined as number | undefined,
      usageTrend: [] as Array<{ date: string; count: number }>,
    };

    // In a full implementation, you would:
    // 1. Query interview sessions/reports to calculate averageScore
    // 2. Query code execution results to calculate successRate
    // 3. Aggregate usage over time for usageTrend
    // For now, return basic stats from question entity

    return stats;
  }
}
