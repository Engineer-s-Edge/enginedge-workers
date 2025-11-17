/**
 * Validation Service Adapter Implementation
 *
 * Bridges orchestrator with ValidationService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IValidationAdapter,
  ValidationConfig,
  ValidationResult,
} from '../interfaces';
import { ValidationService } from '../../../application/services/validation.service';

@Injectable()
export class ValidationAdapter implements IValidationAdapter {
  private readonly logger = new Logger(ValidationAdapter.name);

  constructor(private readonly validationService: ValidationService) {}

  async validate(config: ValidationConfig): Promise<ValidationResult> {
    try {
      this.logger.log(`Validating research for topic: ${config.topic}`);
      return await this.validationService.validate(config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Validation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  async validateBatch(
    configs: ValidationConfig[],
  ): Promise<ValidationResult[]> {
    try {
      this.logger.log(`Validating batch of ${configs.length} reports`);
      return await this.validationService.validateBatch(configs);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Batch validation failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  async checkSourceCredibility(sources: string[]): Promise<number> {
    try {
      this.logger.log(`Checking credibility of ${sources.length} sources`);
      return await this.validationService.checkSourceCredibility(sources);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Source credibility check failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async checkFindingConsistency(findings: string[]): Promise<boolean> {
    try {
      this.logger.log(`Checking consistency of ${findings.length} findings`);
      return await this.validationService.checkFindingConsistency(findings);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Finding consistency check failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
