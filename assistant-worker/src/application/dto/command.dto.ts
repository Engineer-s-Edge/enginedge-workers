/**
 * Command DTOs for worker task processing
 */

export interface CommandDto {
  taskId: string;
  taskType: 'EXECUTE_ASSISTANT' | 'SCHEDULE_HABITS' | string;
  payload?: Record<string, unknown>;
}

export interface CommandResultDto {
  taskId: string;
  status: 'SUCCESS' | 'FAILURE';
  result?: Record<string, unknown>;
  error?: string;
}

export interface WorkerStatusDto {
  nodeType: string;
  workerId: string;
  timestamp: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'BUSY' | 'IDLE';
}
