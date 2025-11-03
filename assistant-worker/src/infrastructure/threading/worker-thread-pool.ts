import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as os from 'os';
import { ILogger } from '@application/ports/logger.port';

export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  data: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  priority: number;
  createdAt: Date;
}

export interface WorkerThreadConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number; // ms
  taskTimeout: number; // ms
}

@Injectable()
export class WorkerThreadPool implements OnModuleDestroy {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private taskQueue: Array<WorkerTask<any, any>> = [];
  private activeTaskCount = 0;
  private readonly config: WorkerThreadConfig;
  private shutdownRequested = false;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    @Inject('WORKER_THREAD_CONFIG') config?: Partial<WorkerThreadConfig>,
  ) {
    const cpuCount = os.cpus().length;
    this.config = {
      minWorkers: config?.minWorkers ?? Math.max(2, cpuCount - 1),
      maxWorkers: config?.maxWorkers ?? cpuCount * 2,
      idleTimeout: config?.idleTimeout ?? 30000,
      taskTimeout: config?.taskTimeout ?? 60000,
    };

    this.logger.info(
      `WorkerThreadPool: Initializing with ${this.config.minWorkers}-${this.config.maxWorkers} workers`,
    );
    this.initializeMinWorkers();
  }

  private initializeMinWorkers(): void {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    // Note: Worker script path should be configured based on your setup
    const workerScript = `
      const { parentPort } = require('worker_threads');

      parentPort.on('message', async (task) => {
        try {
          // Execute task - this would be replaced with actual agent execution
          const result = await executeAgentTask(task);
          parentPort.postMessage({ success: true, result });
        } catch (error) {
          parentPort.postMessage({
            success: false,
            error: error.message,
            stack: error.stack
          });
        }
      });

      async function executeAgentTask(task) {
        // Placeholder: Actual implementation would load and execute agent
        return { completed: true, taskId: task.id };
      }
    `;

    const worker = new Worker(workerScript, { eval: true });

    worker.on('error', (err) => {
      this.logger.error('WorkerThreadPool: Worker error: ${err.message}', {
        stack: err.stack,
      });
      this.handleWorkerFailure(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.shutdownRequested) {
        this.logger.warn('WorkerThreadPool: Worker exited unexpectedly', {
          code,
        });
        this.handleWorkerFailure(worker);
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    this.logger.debug('WorkerThreadPool: Worker created', {
      totalWorkers: this.workers.length,
    });
    return worker;
  }

  private handleWorkerFailure(worker: Worker): void {
    // Remove failed worker
    this.workers = this.workers.filter((w) => w !== worker);
    this.availableWorkers = this.availableWorkers.filter((w) => w !== worker);

    // Replace with new worker if below minimum
    if (
      this.workers.length < this.config.minWorkers &&
      !this.shutdownRequested
    ) {
      this.createWorker();
    }

    // Retry pending tasks
    this.processQueue();
  }

  async execute<T, R>(
    taskId: string,
    data: T,
    priority: number = 0,
  ): Promise<R> {
    if (this.shutdownRequested) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: taskId,
        data,
        resolve,
        reject,
        priority,
        createdAt: new Date(),
      };

      this.taskQueue.push(task);
      this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first

      this.processQueue();

      // Timeout handler
      const timeout = setTimeout(() => {
        const index = this.taskQueue.findIndex((t) => t.id === taskId);
        if (index !== -1) {
          this.taskQueue.splice(index, 1);
          reject(
            new Error(
              `Task ${taskId} timed out after ${this.config.taskTimeout}ms`,
            ),
          );
        }
      }, this.config.taskTimeout);

      // Clear timeout if task completes
      const originalResolve = resolve;
      const originalReject = reject;
      task.resolve = (value: R) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
      task.reject = (error: Error) => {
        clearTimeout(timeout);
        originalReject(error);
      };
    });
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      const worker = this.availableWorkers.shift();
      if (!worker) {
        this.taskQueue.unshift(task);
        break;
      }

      this.executeTask(worker, task);
    }

    // Scale up if needed
    if (
      this.taskQueue.length > 0 &&
      this.availableWorkers.length === 0 &&
      this.workers.length < this.config.maxWorkers
    ) {
      this.logger.info('WorkerThreadPool: Scaling up due to backlog');
      const newWorker = this.createWorker();
      // New worker will process queue automatically via processQueue call
    }
  }

  private executeTask<T, R>(worker: Worker, task: WorkerTask<T, R>): void {
    this.activeTaskCount++;

    const messageHandler = (message: {
      success: boolean;
      result?: R;
      error?: string;
      stack?: string;
    }) => {
      worker.off('message', messageHandler);
      this.availableWorkers.push(worker);
      this.activeTaskCount--;

      if (message.success) {
        task.resolve(message.result as R);
      } else {
        const error = new Error(message.error || 'Unknown worker error');
        error.stack = message.stack;
        task.reject(error);
      }

      this.processQueue();
    };

    worker.on('message', messageHandler);
    worker.postMessage(task.data);

    this.logger.debug('WorkerThreadPool: Task assigned', {
      taskId: task.id,
      activeTaskCount: this.activeTaskCount,
      queueLength: this.taskQueue.length,
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info('WorkerThreadPool: Shutting down worker pool');
    this.shutdownRequested = true;

    // Wait for active tasks to complete (with timeout)
    const shutdownTimeout = 10000; // 10s
    const startTime = Date.now();

    while (
      this.activeTaskCount > 0 &&
      Date.now() - startTime < shutdownTimeout
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.activeTaskCount > 0) {
      this.logger.warn('WorkerThreadPool: Forcing shutdown', {
        activeTaskCount: this.activeTaskCount,
      });
    }

    // Terminate all workers
    for (const worker of this.workers) {
      await worker.terminate();
    }

    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];

    this.logger.info('WorkerThreadPool: Worker pool shutdown complete');
  }

  getMetrics() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      activeTasks: this.activeTaskCount,
      queuedTasks: this.taskQueue.length,
      config: this.config,
    };
  }
}
