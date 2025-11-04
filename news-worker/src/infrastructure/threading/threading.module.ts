import { Module } from '@nestjs/common';
import { WorkerThreadPool, WorkerThreadConfig } from './worker-thread-pool';
import { RequestQueue } from './request-queue';
import { BackpressureHandler, BackpressureConfig } from './backpressure-handler';

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
    {
      provide: 'BACKPRESSURE_CONFIG',
      useValue: {
        lowThreshold: 10,
        mediumThreshold: 50,
        highThreshold: 100,
        criticalThreshold: 200,
        shedProbability: {
          low: 0,
          medium: 0.1,
          high: 0.3,
          critical: 0.7,
        },
      } as BackpressureConfig,
    },
    WorkerThreadPool,
    RequestQueue,
    BackpressureHandler,
  ],
  exports: [
    WorkerThreadPool,
    RequestQueue,
    BackpressureHandler,
  ],
})
export class ThreadingModule {}
