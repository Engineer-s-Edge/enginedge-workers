import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsAdapter } from '../adapters/monitoring/metrics.adapter';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsAdapter: MetricsAdapter) {}

  @Get()
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
    type: String,
  })
  async getMetrics(): Promise<string> {
    return await this.metricsAdapter.getMetrics();
  }
}
