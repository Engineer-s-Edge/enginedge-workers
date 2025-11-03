import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

export interface QueuedRequest<T = unknown> {
  id: string;
  data: T;
  priority: number;
  enqueuedAt: Date;
  retryCount: number;
  maxRetries: number;
}

export interface QueueMetrics {
  size: number;
  processing: number;
  failed: number;
  completed: number;
  avgWaitTime: number;
}

@Injectable()
export class RequestQueue<T = unknown> {
  private queue: QueuedRequest<T>[] = [];
  private processing = new Set<string>();
  private completedCount = 0;
  private failedCount = 0;
  private waitTimes: number[] = [];
  private readonly maxWaitTimeSamples = 100;

  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  enqueue(
    id: string,
    data: T,
    priority: number = 0,
    maxRetries: number = 3,
  ): void {
    const request: QueuedRequest<T> = {
      id,
      data,
      priority,
      enqueuedAt: new Date(),
      retryCount: 0,
      maxRetries,
    };

    this.queue.push(request);
    this.queue.sort((a, b) => {
      // Sort by priority desc, then by enqueuedAt asc
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
    });

    this.logger.debug('RequestQueue: Enqueued request', {
      id,
      priority,
      queueSize: this.queue.length,
    });
  }

  dequeue(): QueuedRequest<T> | undefined {
    const request = this.queue.shift();
    if (request) {
      this.processing.add(request.id);
      const waitTime = Date.now() - request.enqueuedAt.getTime();
      this.recordWaitTime(waitTime);

      this.logger.debug('RequestQueue: Dequeued request', {
        requestId: request.id,
        waitTime,
      });
    }
    return request;
  }

  markComplete(id: string): void {
    this.processing.delete(id);
    this.completedCount++;
    this.logger.debug('RequestQueue: Request completed', { id });
  }

  markFailed(id: string, shouldRetry: boolean = true): boolean {
    this.processing.delete(id);

    if (shouldRetry) {
      const request = this.findById(id);
      if (request && request.retryCount < request.maxRetries) {
        request.retryCount++;
        this.enqueue(
          request.id,
          request.data,
          request.priority,
          request.maxRetries,
        );
        this.logger.warn('RequestQueue: Request retry', {
          id,
          retryCount: request.retryCount,
          maxRetries: request.maxRetries,
        });
        return true;
      }
    }

    this.failedCount++;
    this.logger.error('RequestQueue: Request ${id} failed permanently');
    return false;
  }

  private findById(id: string): QueuedRequest<T> | undefined {
    return this.queue.find((req) => req.id === id);
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((req) => req.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.logger.debug('RequestQueue: Removed request', { id });
      return true;
    }
    return false;
  }

  clear(): void {
    const size = this.queue.length;
    this.queue = [];
    this.logger.info('RequestQueue: Cleared queue', { clearedCount: size });
  }

  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxWaitTimeSamples) {
      this.waitTimes.shift();
    }
  }

  getMetrics(): QueueMetrics {
    const avgWaitTime =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((sum, time) => sum + time, 0) /
          this.waitTimes.length
        : 0;

    return {
      size: this.queue.length,
      processing: this.processing.size,
      failed: this.failedCount,
      completed: this.completedCount,
      avgWaitTime: Math.round(avgWaitTime),
    };
  }

  peek(): QueuedRequest<T> | undefined {
    return this.queue[0];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}
