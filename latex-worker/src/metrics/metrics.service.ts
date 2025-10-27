import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  public readonly register: Registry;

  // Compilation metrics
  public readonly compilationDuration: Histogram;
  public readonly compilationTotal: Counter;
  public readonly compilationSuccessTotal: Counter;
  public readonly compilationErrorTotal: Counter;

  // Queue metrics
  public readonly queueDepth: Gauge;
  public readonly activeJobs: Gauge;

  // Error metrics
  public readonly errorsByType: Counter;

  // Performance metrics
  public readonly packageCacheHits: Counter;
  public readonly packageCacheMisses: Counter;
  public readonly compilationSteps: Counter;

  // Resource metrics
  public readonly memoryUsage: Gauge;
  public readonly cpuUsage: Gauge;

  constructor() {
    this.register = new Registry();

    // Enable default metrics (CPU, memory, event loop, etc.)
    collectDefaultMetrics({ register: this.register });

    // Compilation duration histogram (in seconds)
    this.compilationDuration = new Histogram({
      name: 'latex_compilation_duration_seconds',
      help: 'Duration of LaTeX compilations in seconds',
      labelNames: ['document_type', 'success'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60], // 500ms to 60s
      registers: [this.register],
    });

    // Total compilations counter
    this.compilationTotal = new Counter({
      name: 'latex_compilation_total',
      help: 'Total number of LaTeX compilations',
      labelNames: ['document_type'],
      registers: [this.register],
    });

    // Successful compilations counter
    this.compilationSuccessTotal = new Counter({
      name: 'latex_compilation_success_total',
      help: 'Total number of successful LaTeX compilations',
      labelNames: ['document_type'],
      registers: [this.register],
    });

    // Failed compilations counter
    this.compilationErrorTotal = new Counter({
      name: 'latex_compilation_error_total',
      help: 'Total number of failed LaTeX compilations',
      labelNames: ['document_type', 'error_type'],
      registers: [this.register],
    });

    // Queue depth gauge
    this.queueDepth = new Gauge({
      name: 'latex_queue_depth',
      help: 'Number of jobs waiting in the compilation queue',
      registers: [this.register],
    });

    // Active jobs gauge
    this.activeJobs = new Gauge({
      name: 'latex_active_jobs',
      help: 'Number of currently processing LaTeX jobs',
      registers: [this.register],
    });

    // Errors by type counter
    this.errorsByType = new Counter({
      name: 'latex_errors_by_type_total',
      help: 'Total number of errors by type',
      labelNames: ['error_type', 'error_category'],
      registers: [this.register],
    });

    // Package cache hits
    this.packageCacheHits = new Counter({
      name: 'latex_package_cache_hits_total',
      help: 'Total number of package cache hits',
      registers: [this.register],
    });

    // Package cache misses
    this.packageCacheMisses = new Counter({
      name: 'latex_package_cache_misses_total',
      help: 'Total number of package cache misses',
      registers: [this.register],
    });

    // Compilation steps (multi-pass)
    this.compilationSteps = new Counter({
      name: 'latex_compilation_steps_total',
      help: 'Total number of compilation steps (for multi-pass)',
      labelNames: ['pass_type'],
      registers: [this.register],
    });

    // Memory usage gauge
    this.memoryUsage = new Gauge({
      name: 'latex_memory_usage_bytes',
      help: 'Current memory usage in bytes',
      registers: [this.register],
    });

    // CPU usage gauge
    this.cpuUsage = new Gauge({
      name: 'latex_cpu_usage_percent',
      help: 'Current CPU usage percentage',
      registers: [this.register],
    });
  }

  onModuleInit() {
    // Start collecting resource metrics every 10 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 10000);
  }

  private collectResourceMetrics() {
    const usage = process.memoryUsage();
    this.memoryUsage.set(usage.heapUsed);

    // CPU usage (simplified - in production, use more sophisticated method)
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.cpuUsage.set(totalUsage);
  }

  /**
   * Record a compilation attempt
   */
  recordCompilation(documentType: string, durationMs: number, success: boolean, errorType?: string) {
    const durationSeconds = durationMs / 1000;

    this.compilationDuration.observe(
      { document_type: documentType, success: success.toString() },
      durationSeconds,
    );

    this.compilationTotal.inc({ document_type: documentType });

    if (success) {
      this.compilationSuccessTotal.inc({ document_type: documentType });
    } else {
      this.compilationErrorTotal.inc({
        document_type: documentType,
        error_type: errorType || 'unknown',
      });
    }
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(queueDepth: number, activeJobs: number) {
    this.queueDepth.set(queueDepth);
    this.activeJobs.set(activeJobs);
  }

  /**
   * Record an error
   */
  recordError(errorType: string, errorCategory: string) {
    this.errorsByType.inc({ error_type: errorType, error_category: errorCategory });
  }

  /**
   * Record package cache hit or miss
   */
  recordPackageCacheHit(hit: boolean) {
    if (hit) {
      this.packageCacheHits.inc();
    } else {
      this.packageCacheMisses.inc();
    }
  }

  /**
   * Record compilation step
   */
  recordCompilationStep(passType: string) {
    this.compilationSteps.inc({ pass_type: passType });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get content type for Prometheus
   */
  getContentType(): string {
    return this.register.contentType;
  }
}
