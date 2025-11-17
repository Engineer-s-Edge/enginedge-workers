/**
 * Validation Service Adapter Implementation
 *
 * Bridges orchestrator with ValidationService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  BatchValidationRequest,
  BatchValidationResult,
  ValidateExpertWorkRequest,
  ValidationResult,
  ValidationConfig,
  ValidationStatistics,
} from '@domain/validation/validation.types';
import { IValidationAdapter } from '../interfaces';
import { ValidationService } from '../../../application/services/validation.service';

@Injectable()
export class ValidationAdapter implements IValidationAdapter {
  private readonly logger = new Logger(ValidationAdapter.name);

  constructor(private readonly validationService: ValidationService) {}

  async validate(
    request: ValidateExpertWorkRequest,
  ): Promise<ValidationResult> {
    try {
      this.logger.log(
        `Validating research for topic: ${request.expertReport.topic}`,
      );
      return await this.validationService.validateExpertWork(request);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Validation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  async validateBatch(
    request: BatchValidationRequest,
  ): Promise<BatchValidationResult> {
    try {
      this.logger.log(
        `Validating batch of ${request.expertReports.length} reports`,
      );
      return await this.validationService.validateBatch(request);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Batch validation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  getConfig(): ValidationConfig {
    return this.validationService.getConfig();
  }

  updateConfig(config: Partial<ValidationConfig>): ValidationConfig {
    return this.validationService.updateConfig(config);
  }

  getStatistics(): ValidationStatistics {
    return this.validationService.getStatistics();
  }
}
