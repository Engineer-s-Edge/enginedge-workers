/**
 * Expert Pool Adapter Implementation
 *
 * Hexagonal architecture adapter that bridges the orchestrator layer with the expert pool domain service.
 * Implements the IExpertPoolAdapter port interface.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IExpertPoolAdapter,
  ExpertAllocationRequest,
  AllocationResult,
  ExpertAgent,
} from '../interfaces';
import {
  ExpertPoolManager,
  ExpertAgentInstance,
} from '../../../domain/services/expert-pool-manager.service';

@Injectable()
export class ExpertPoolAdapter implements IExpertPoolAdapter {
  private readonly logger = new Logger(ExpertPoolAdapter.name);

  constructor(private readonly expertPoolManager: ExpertPoolManager) {
    this.logger.log('Expert Pool Adapter initialized with real ExpertPoolManager');
  }

  async allocateExperts(request: ExpertAllocationRequest): Promise<AllocationResult> {
    try {
      this.logger.log(
        `Allocating ${request.count} experts with specialization: ${request.specialization || 'any'}`,
      );

      // Delegate to real expert pool manager
      const result = await this.expertPoolManager.allocateExperts(request);

      // Convert internal representation to adapter interface
      const allocated: ExpertAgent[] = result.allocated.map((expert: ExpertAgentInstance) => ({
        id: expert.id,
        specialization: expert.specialization,
        complexity: expert.complexity,
        availability: expert.availability,
        expertise: expert.expertise,
      }));

      return {
        allocated,
        failed: result.failed,
        timestamp: result.timestamp,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Expert allocation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  async releaseExperts(expertIds: string[]): Promise<boolean> {
    try {
      this.logger.log(`Releasing ${expertIds.length} experts`);
      return await this.expertPoolManager.releaseExperts(expertIds);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Expert release failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getAvailableCount(): Promise<number> {
    try {
      return await this.expertPoolManager.getAvailableCount();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get available count: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getExpert(expertId: string): Promise<ExpertAgent | null> {
    try {
      const expert = await this.expertPoolManager.getExpert(expertId);
      if (!expert) return null;

      return {
        id: expert.id,
        specialization: expert.specialization,
        complexity: expert.complexity,
        availability: expert.availability,
        expertise: expert.expertise,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get expert: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getAvailableExperts(): Promise<ExpertAgent[]> {
    try {
      const experts = await this.expertPoolManager.getAvailableExperts();
      return experts.map((expert: ExpertAgentInstance) => ({
        id: expert.id,
        specialization: expert.specialization,
        complexity: expert.complexity,
        availability: expert.availability,
        expertise: expert.expertise,
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get available experts: ${err.message}`, err.stack);
      throw error;
    }
  }

  async isExpertAvailable(expertId: string): Promise<boolean> {
    try {
      return await this.expertPoolManager.isExpertAvailable(expertId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to check expert availability: ${err.message}`, err.stack);
      throw error;
    }
  }
}

