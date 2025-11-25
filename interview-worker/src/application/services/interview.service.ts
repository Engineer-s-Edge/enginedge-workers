/**
 * Interview Service
 *
 * Application service for managing interview configurations.
 */

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Interview } from '../../domain/entities';
import { IInterviewRepository } from '../ports/repositories.port';
import { CreateInterviewDto } from '../dto/create-interview.dto';
import { MongoFavoriteRepository } from '../../infrastructure/adapters/database/favorite.repository';

@Injectable()
export class InterviewService {
  constructor(
    @Inject('IInterviewRepository')
    private readonly interviewRepository: IInterviewRepository,
    private readonly favoriteRepository: MongoFavoriteRepository,
  ) {}

  async createInterview(dto: CreateInterviewDto): Promise<Interview> {
    const interview = new Interview({
      id: uuidv4(),
      userId: dto.userId,
      title: dto.title,
      description: dto.description,
      phases: dto.phases.map((p) => ({
        phaseId: p.phaseId,
        type: p.type,
        duration: p.duration,
        difficulty: p.difficulty,
        questionCount: p.questionCount,
        tags: p.tags,
        promptOverride: p.promptOverride,
        config: p.config,
      })),
      config: {
        allowPause: dto.config.allowPause ?? true,
        maxPauseDuration: dto.config.maxPauseDuration ?? null,
        allowSkip: dto.config.allowSkip ?? true,
        maxSkips: dto.config.maxSkips ?? null,
        totalTimeLimit: dto.config.totalTimeLimit,
      },
      rubric: dto.rubric,
      visibility: dto.visibility || 'private',
      publishedAt: dto.visibility === 'public' ? new Date() : undefined,
      usageCount: 0,
      favoriteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.interviewRepository.save(interview);
  }

  async getInterview(id: string): Promise<Interview | null> {
    return await this.interviewRepository.findById(id);
  }

  async getAllInterviews(): Promise<Interview[]> {
    return await this.interviewRepository.findAll();
  }

  async updateInterview(
    id: string,
    updates: Partial<Interview>,
  ): Promise<Interview | null> {
    return await this.interviewRepository.update(id, {
      ...updates,
      updatedAt: new Date(),
    } as Partial<Interview>);
  }

  async deleteInterview(id: string): Promise<boolean> {
    return await this.interviewRepository.delete(id);
  }

  async duplicateInterview(
    id: string,
    title?: string,
    description?: string,
  ): Promise<Interview | null> {
    const original = await this.interviewRepository.findById(id);
    if (!original) {
      return null;
    }

    const duplicated = new Interview({
      id: uuidv4(),
      userId: original.userId,
      title: title || `Copy of ${original.title}`,
      description: description || `Duplicated from ${original.id}`,
      phases: original.phases.map((p) => ({ ...p })),
      config: { ...original.config },
      rubric: { ...original.rubric },
      visibility: 'private',
      usageCount: 0,
      favoriteCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.interviewRepository.save(duplicated);
  }

  async publishInterview(
    id: string,
    visibility: 'private' | 'public' | 'unlisted',
  ): Promise<Interview | null> {
    const interview = await this.interviewRepository.findById(id);
    if (!interview) {
      return null;
    }

    const updates: Partial<Interview> = {
      visibility,
      updatedAt: new Date(),
    };

    if (visibility === 'public') {
      updates.publishedAt = new Date();
    } else {
      updates.publishedAt = undefined;
    }

    return await this.interviewRepository.update(id, updates);
  }

  async getPublicInterviews(options?: {
    page?: number;
    limit?: number;
    sortBy?: 'popular' | 'recent' | 'usage';
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    search?: string;
  }): Promise<{
    interviews: Interview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const result = await this.interviewRepository.findPublicInterviews(options);
    return {
      interviews: result.interviews,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async getUserInterviews(userId: string): Promise<Interview[]> {
    return await this.interviewRepository.findByUserId(userId);
  }

  async reorderPhases(
    id: string,
    phaseOrder: string[],
  ): Promise<Interview | null> {
    const interview = await this.interviewRepository.findById(id);
    if (!interview) {
      return null;
    }

    // Validate that all phaseIds exist and are included
    const existingPhaseIds = interview.phases.map((p) => p.phaseId);
    const uniqueOrder = [...new Set(phaseOrder)];

    if (uniqueOrder.length !== existingPhaseIds.length) {
      throw new Error('Phase order must include all phases exactly once');
    }

    for (const phaseId of phaseOrder) {
      if (!existingPhaseIds.includes(phaseId)) {
        throw new Error(`Phase ${phaseId} does not exist in interview`);
      }
    }

    // Reorder phases
    const phaseMap = new Map(interview.phases.map((p) => [p.phaseId, p]));
    const reorderedPhases = phaseOrder.map((phaseId) => phaseMap.get(phaseId)!);

    return await this.interviewRepository.update(id, {
      phases: reorderedPhases,
      updatedAt: new Date(),
    } as Partial<Interview>);
  }

  async favoriteInterview(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; favoriteCount: number } | null> {
    const interview = await this.interviewRepository.findById(id);
    if (!interview) {
      return null;
    }

    const wasFavorite = await this.favoriteRepository.isFavorite(userId, id);
    if (!wasFavorite) {
      await this.favoriteRepository.addFavorite(userId, id);
      const favoriteCount = await this.favoriteRepository.getFavoriteCount(id);
      await this.interviewRepository.update(id, {
        favoriteCount,
        updatedAt: new Date(),
      } as Partial<Interview>);
      return { success: true, favoriteCount };
    }

    const favoriteCount = await this.favoriteRepository.getFavoriteCount(id);
    return { success: true, favoriteCount };
  }

  async unfavoriteInterview(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; favoriteCount: number } | null> {
    const interview = await this.interviewRepository.findById(id);
    if (!interview) {
      return null;
    }

    await this.favoriteRepository.removeFavorite(userId, id);
    const favoriteCount = await this.favoriteRepository.getFavoriteCount(id);
    await this.interviewRepository.update(id, {
      favoriteCount,
      updatedAt: new Date(),
    } as Partial<Interview>);
    return { success: true, favoriteCount };
  }

  async getFavoriteInterviews(
    userId: string,
  ): Promise<{ interviews: Interview[] }> {
    const favoriteIds = await this.favoriteRepository.getUserFavorites(userId);
    const interviews: Interview[] = [];

    for (const interviewId of favoriteIds) {
      const interview = await this.interviewRepository.findById(interviewId);
      if (interview) {
        interviews.push(interview);
      }
    }

    return { interviews };
  }
}
