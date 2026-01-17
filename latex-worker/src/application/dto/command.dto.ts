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
