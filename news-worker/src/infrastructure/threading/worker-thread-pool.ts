import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as os from 'os';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

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
    @Inject('ILogger') private readonly logger: Logger,
    @Inject('WORKER_THREAD_CONFIG') config?: Partial<WorkerThreadConfig>,
  ) {
    const cpuCount = os.cpus().length;
    this.config = {
      minWorkers: config?.minWorkers ?? Math.max(2, cpuCount - 1),
      maxWorkers: config?.maxWorkers ?? cpuCount * 2,
      idleTimeout: config?.idleTimeout ?? 30000,
      taskTimeout: config?.taskTimeout ?? 60000,
    };

    this.logger.info(`WorkerThreadPool: Initializing with ${this.config.minWorkers}-${this.config.maxWorkers} workers`);
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
      this.logger.error('WorkerThreadPool: Worker error: ${err.message}', { stack: err.stack });
      this.handleWorkerFailure(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.shutdownRequested) {
        this.logger.warn('WorkerThreadPool: Worker exited unexpectedly', { code });
        this.handleWorkerFailure(worker);
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    this.logger.debug('WorkerThreadPool: Worker created', { totalWorkers: this.workers.length });
    return worker;
  }

  private handleWorkerFailure(worker: Worker): void {
    // Remove failed worker
    this.workers = this.workers.filter(w => w !== worker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== worker);

    // Create replacement if we're below minimum
    if (this.workers.length < this.config.minWorkers && !this.shutdownRequested) {
      this.createWorker();
    }
  }

  /**
   * Execute a task in a worker thread
   */
  async executeTask<T, R>(data: T, priority = 0): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data,
        resolve,
        reject,
        priority,
        createdAt: new Date(),
      };

      // Add to queue
      this.taskQueue.push(task);
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      // Try to assign to available worker
      this.assignTaskToWorker();

      // Set timeout
      setTimeout(() => {
        if (this.taskQueue.includes(task)) {
          this.taskQueue = this.taskQueue.filter(t => t !== task);
          reject(new Error(`Task ${task.id} timed out after ${this.config.taskTimeout}ms`));
        }
      }, this.config.taskTimeout);
    });
  }

  private assignTaskToWorker(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.availableWorkers.shift();
    if (!availableWorker) {
      // No available workers, try to create one if under max
      if (this.workers.length < this.config.maxWorkers) {
        const newWorker = this.createWorker();
        this.assignTaskToWorkerWithWorker(newWorker);
      }
      return;
    }

    this.assignTaskToWorkerWithWorker(availableWorker);
  }

  private assignTaskToWorkerWithWorker(worker: Worker): void {
    const task = this.taskQueue.shift();
    if (!task) {
      this.availableWorkers.push(worker);
      return;
    }

    this.activeTaskCount++;

    // Set up message handler for this task
    const messageHandler = (result: { success: boolean; result?: R; error?: string; stack?: string }) => {
      worker.off('message', messageHandler);
      this.availableWorkers.push(worker);

      this.activeTaskCount--;

      if (result.success) {
        task.resolve(result.result as R);
      } else {
        task.reject(new Error(result.error || 'Unknown worker error'));
      }

      // Try to assign next task
      this.assignTaskToWorker();
    };

    worker.on('message', messageHandler);
    worker.postMessage(task.data);
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    activeTasks: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      activeTasks: this.activeTaskCount,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.shutdownRequested = true;
    this.logger.info('WorkerThreadPool: Shutting down worker pool');

    // Reject all queued tasks
    this.taskQueue.forEach(task => {
      task.reject(new Error('Worker pool shutting down'));
    });
    this.taskQueue = [];

    // Terminate all workers
    const terminationPromises = this.workers.map(worker => {
      return new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve());
      });
    });

    await Promise.all(terminationPromises);
    this.logger.info('WorkerThreadPool: All workers terminated');
  }
}
