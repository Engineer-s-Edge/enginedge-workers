/**
 * Deadlock Detection Port
 *
 * Port interface for deadlock detection to maintain hexagonal architecture.
 */

import { CollectiveTask } from '../entities/collective-task.entity';

export interface DeadlockInfo {
  id: string;
  cycle: string[];
  involvedAgents: string[];
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high';
}

export interface IDeadlockDetectionService {
  detectDeadlocks(tasks: CollectiveTask[]): Promise<DeadlockInfo[]>;
  isTaskDeadlocked(taskId: string, tasks: CollectiveTask[]): Promise<boolean>;
  findDeadlockRisks(tasks: CollectiveTask[]): Promise<string[]>;
}
