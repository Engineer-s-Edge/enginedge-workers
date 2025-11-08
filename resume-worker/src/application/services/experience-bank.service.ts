import { Injectable, Inject } from '@nestjs/common';
import { Types } from 'mongoose';

export interface ExperienceBankItemMetadata {
  technologies: string[];
  role: string;
  company: string;
  dateRange: {
    start: Date;
    end: Date | null;
  };
  metrics: string[];
  keywords: string[];
  reviewed: boolean;
  linkedExperienceId: Types.ObjectId | null;
  category: string;
  impactScore: number;
  atsScore: number;
  lastUsedDate: Date | null;
  usageCount: number;
}

export interface ExperienceBankItem {
  _id: Types.ObjectId;
  userId: string;
  bulletText: string;
  vector: number[];
  vectorModel: string;
  metadata: ExperienceBankItemMetadata;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddBulletData {
  userId: string;
  bulletText: string;
  vector?: number[];
  metadata: ExperienceBankItemMetadata;
}

export interface SearchOptions {
  query?: string;
  filters?: {
    technologies?: string[];
    role?: string;
    reviewed?: boolean;
    minImpactScore?: number;
  };
  limit?: number;
}

export interface ListOptions {
  reviewed?: boolean;
  limit?: number;
}

@Injectable()
export class ExperienceBankService {
  constructor() {} // TODO: Inject repository when implemented

  async addBullet(
    userId: string,
    bulletText: string,
    vector: number[],
    metadata: ExperienceBankItemMetadata,
  ): Promise<ExperienceBankItem> {
    // TODO: Implement repository call
    throw new Error('Not implemented');
  }

  async add(data: AddBulletData): Promise<ExperienceBankItem> {
    // TODO: Implement repository call
    throw new Error('Not implemented');
  }

  async search(
    userIdOrQuery: string | SearchOptions,
    options?: SearchOptions,
  ): Promise<ExperienceBankItem[]> {
    // TODO: Implement repository call
    return [];
  }

  async findById(id: Types.ObjectId): Promise<ExperienceBankItem | null> {
    // TODO: Implement repository call
    return null;
  }

  async findByUser(
    userId: string,
    options?: ListOptions,
  ): Promise<ExperienceBankItem[]> {
    // TODO: Implement repository call
    return [];
  }

  async list(
    userId: string,
    options?: ListOptions,
  ): Promise<ExperienceBankItem[]> {
    // TODO: Implement repository call
    return [];
  }

  async markAsReviewed(bulletId: string): Promise<void> {
    // TODO: Implement repository call
  }

  async markReviewed(id: Types.ObjectId, reviewed: boolean): Promise<void> {
    // TODO: Implement repository call
  }

  async updateUsage(id: Types.ObjectId): Promise<void> {
    // TODO: Implement repository call
  }

  async delete(id: Types.ObjectId): Promise<void> {
    // TODO: Implement repository call
  }

  async getById(bulletId: string): Promise<ExperienceBankItem | null> {
    // TODO: Implement repository call
    return null;
  }
}
