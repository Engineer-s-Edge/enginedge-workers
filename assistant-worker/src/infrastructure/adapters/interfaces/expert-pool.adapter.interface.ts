/**
 * Expert Pool Adapter Interface
 * 
 * Port interface for expert agent management
 * Abstracts external ExpertPoolManager implementation
 */

export interface ExpertAllocationRequest {
  count: number;
  specialization?: string;
  complexity?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
  expertise?: string[];
}

export interface ExpertAgent {
  id: string;
  specialization: string;
  complexity: number;
  availability: boolean;
  expertise: string[];
}

export interface AllocationResult {
  allocated: ExpertAgent[];
  failed: string[];
  timestamp: Date;
}

export interface IExpertPoolAdapter {
  /**
   * Allocate experts based on requirements
   */
  allocateExperts(request: ExpertAllocationRequest): Promise<AllocationResult>;

  /**
   * Release previously allocated experts
   */
  releaseExperts(expertIds: string[]): Promise<boolean>;

  /**
   * Get available experts count
   */
  getAvailableCount(): Promise<number>;

  /**
   * Get expert details
   */
  getExpert(expertId: string): Promise<ExpertAgent | null>;

  /**
   * Get all available experts
   */
  getAvailableExperts(): Promise<ExpertAgent[]>;

  /**
   * Check expert availability
   */
  isExpertAvailable(expertId: string): Promise<boolean>;
}
