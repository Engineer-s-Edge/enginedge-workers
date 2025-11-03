/**
 * Metrics Controller
 *
 * Exposes Prometheus metrics endpoint.
 */

import { Controller, Get } from '@nestjs/common';
import { MetricsAdapter } from '../adapters/monitoring/metrics.adapter';

/**
 * Metrics Controller
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsAdapter: MetricsAdapter) {}

  /**
   * Get Prometheus metrics
   */
  @Get()
  async getMetrics(): Promise<string> {
    return this.metricsAdapter.getMetrics();
  }
}
