import { Controller, Get } from '@nestjs/common';
import { WorkerThreadPool } from '../threading/worker-thread-pool';
import { RequestQueue } from '../threading/request-queue';
import { ThreadSafeAgentStore } from '../threading/thread-safe-agent-store';
import { BackpressureHandler } from '../threading/backpressure-handler';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  metrics: {
    workers: ReturnType<WorkerThreadPool['getMetrics']>;
    queue: ReturnType<RequestQueue['getMetrics']>;
    store: ReturnType<ThreadSafeAgentStore['getMetrics']>;
    backpressure: ReturnType<BackpressureHandler['getMetrics']>;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly workerPool: WorkerThreadPool,
    private readonly requestQueue: RequestQueue,
    private readonly agentStore: ThreadSafeAgentStore,
    private readonly backpressure: BackpressureHandler,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const workerMetrics = this.workerPool.getMetrics();
    const queueMetrics = this.requestQueue.getMetrics();
    const storeMetrics = this.agentStore.getMetrics();
    const backpressureMetrics = this.backpressure.getMetrics();
    const memUsage = process.memoryUsage();

    const status = this.determineStatus(
      workerMetrics,
      queueMetrics,
      storeMetrics,
    );

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: {
        workers: workerMetrics,
        queue: queueMetrics,
        store: storeMetrics,
        backpressure: backpressureMetrics,
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  }

  @Get('ready')
  async readiness(): Promise<{ ready: boolean; reason?: string }> {
    const workerMetrics = this.workerPool.getMetrics();

    // Ready if we have available workers
    if (workerMetrics.availableWorkers > 0) {
      return { ready: true };
    }

    // Check if all workers are busy but system is healthy
    if (workerMetrics.totalWorkers > 0 && workerMetrics.queuedTasks < 100) {
      return { ready: true };
    }

    return {
      ready: false,
      reason: 'No available workers and queue backlog is high',
    };
  }

  @Get('live')
  async liveness(): Promise<{ alive: boolean }> {
    // Simple liveness check - process is running
    return { alive: true };
  }

  private determineStatus(
    workers: ReturnType<WorkerThreadPool['getMetrics']>,
    queue: ReturnType<RequestQueue['getMetrics']>,
    store: ReturnType<ThreadSafeAgentStore['getMetrics']>,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Unhealthy: No workers or critical queue backlog
    if (workers.totalWorkers === 0 || queue.size > 500) {
      return 'unhealthy';
    }

    // Degraded: High queue or many locked agents
    if (
      queue.size > 100 ||
      workers.availableWorkers === 0 ||
      (store.oldestLock && store.oldestLock > 30000)
    ) {
      return 'degraded';
    }

    return 'healthy';
  }
}
