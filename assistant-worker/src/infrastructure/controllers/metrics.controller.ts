/**
 * Metrics Controller
 *
 * Exposes Prometheus metrics endpoint and aggregated dashboard stats.
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
   * Get Prometheus metrics (raw format for Prometheus scraping)
   */
  @Get()
  async getMetrics(): Promise<string> {
    return this.metricsAdapter.getMetrics();
  }

  /**
   * Get aggregated dashboard stats (JSON format for dashboards)
   */
  @Get('dashboard')
  async getDashboardStats() {
    return this.metricsAdapter.getDashboardStats();
  }
}
