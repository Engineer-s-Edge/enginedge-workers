import { Module } from '@nestjs/common';
import { WorkerThreadPool, WorkerThreadConfig } from './worker-thread-pool';

/**
 * Threading Module
 *
 * Provides worker thread pool and concurrency management.
 * Uses ILogger from InfrastructureModule (which is @Global).
 */
@Module({
  providers: [
    {
      provide: 'WORKER_THREAD_CONFIG',
      useValue: {
        minWorkers: 2,
        maxWorkers: 8,
        idleTimeout: 30000,
        taskTimeout: 60000,
      } as WorkerThreadConfig,
    },
    WorkerThreadPool,
  ],
  exports: [WorkerThreadPool],
})
export class ThreadingModule {}
