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

@Injectable()
export class InterviewService {
  constructor(
    @Inject('IInterviewRepository')
    private readonly interviewRepository: IInterviewRepository,
  ) {}

  async createInterview(dto: CreateInterviewDto): Promise<Interview> {
    const interview = new Interview({
      id: uuidv4(),
      title: dto.title,
      description: dto.description,
      phases: dto.phases.map((p) => ({
        phaseId: p.phaseId,
        type: p.type,
        duration: p.duration,
        difficulty: p.difficulty,
        questionCount: p.questionCount,
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
}

