import { Controller, Get } from '@nestjs/common';
import { MLModelClient } from '../../application/services/ml-model-client.service';

@Controller('health')
export class HealthController {
  constructor(private readonly mlClient: MLModelClient) {}

  @Get()
  async getHealth() {
    const mlAvailable = await this.mlClient.healthCheck();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        ml: mlAvailable ? 'connected' : 'unavailable',
      },
    };
  }
}
