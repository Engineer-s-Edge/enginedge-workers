import { Injectable, Inject } from '@nestjs/common';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export enum LoadLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface BackpressureConfig {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  criticalThreshold: number;
  shedProbability: {
    [LoadLevel.LOW]: number;
    [LoadLevel.MEDIUM]: number;
    [LoadLevel.HIGH]: number;
    [LoadLevel.CRITICAL]: number;
  };
}

export interface LoadMetrics {
  queueSize: number;
  activeWorkers: number;
  cpuUsage: number;
  memoryUsage: number;
}

@Injectable()
export class BackpressureHandler {
  private readonly config: BackpressureConfig;
  private sheddedRequests = 0;
  private totalRequests = 0;

  constructor(
    @Inject('ILogger') private readonly logger: Logger,
    @Inject('BACKPRESSURE_CONFIG') config?: Partial<BackpressureConfig>,
  ) {
    this.config = {
      lowThreshold: config?.lowThreshold ?? 10,
      mediumThreshold: config?.mediumThreshold ?? 50,
      highThreshold: config?.highThreshold ?? 100,
      criticalThreshold: config?.criticalThreshold ?? 200,
      shedProbability: {
        [LoadLevel.LOW]: config?.shedProbability?.low ?? 0,
        [LoadLevel.MEDIUM]: config?.shedProbability?.medium ?? 0.1,
        [LoadLevel.HIGH]: config?.shedProbability?.high ?? 0.3,
        [LoadLevel.CRITICAL]: config?.shedProbability?.critical ?? 0.7,
      },
    };
  }

  determineLoadLevel(metrics: LoadMetrics): LoadLevel {
    const { queueSize } = metrics;

    if (queueSize >= this.config.criticalThreshold) {
      return LoadLevel.CRITICAL;
    } else if (queueSize >= this.config.highThreshold) {
      return LoadLevel.HIGH;
    } else if (queueSize >= this.config.mediumThreshold) {
      return LoadLevel.MEDIUM;
    }
    return LoadLevel.LOW;
  }

  shouldShedRequest(loadLevel: LoadLevel, priority: number): boolean {
    this.totalRequests++;

    const baseProbability = this.config.shedProbability[loadLevel];

    // Adjust probability based on priority (0-10 scale)
    // Lower priority = higher chance of shedding
    const priorityFactor = 1 - priority / 10;
    const adjustedProbability = baseProbability * priorityFactor;

    const shouldShed = Math.random() < adjustedProbability;

    if (shouldShed) {
      this.sheddedRequests++;
      this.logger.warn('Shedding request', {
        loadLevel,
        priority,
        probability: adjustedProbability.toFixed(2),
      });
    }

    return shouldShed;
  }

  applyBackpressure(
    metrics: LoadMetrics,
    requestPriority: number,
  ): { shouldAccept: boolean; loadLevel: LoadLevel; reason?: string } {
    const loadLevel = this.determineLoadLevel(metrics);

    if (loadLevel === LoadLevel.LOW) {
      return { shouldAccept: true, loadLevel };
    }

    const shouldShed = this.shouldShedRequest(loadLevel, requestPriority);

    if (shouldShed) {
      return {
        shouldAccept: false,
        loadLevel,
        reason: `Load level ${loadLevel} - request shed based on priority ${requestPriority}`,
      };
    }

    return { shouldAccept: true, loadLevel };
  }

  getMetrics() {
    const shedRate =
      this.totalRequests > 0 ? this.sheddedRequests / this.totalRequests : 0;

    return {
      totalRequests: this.totalRequests,
      sheddedRequests: this.sheddedRequests,
      shedRate: Math.round(shedRate * 100) / 100,
      config: this.config,
    };
  }

  reset(): void {
    this.sheddedRequests = 0;
    this.totalRequests = 0;
    this.logger.info('BackpressureHandler: Metrics reset');
  }
}
