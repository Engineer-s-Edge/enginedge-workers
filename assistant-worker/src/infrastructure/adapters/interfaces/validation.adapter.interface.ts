/**
 * Validation Service Adapter Interface
 *
 * Port interface for research validation.
 */

import {
  BatchValidationRequest,
  BatchValidationResult,
  ValidateExpertWorkRequest,
  ValidationResult,
  ValidationStatistics,
  ValidationConfig,
} from '@domain/validation/validation.types';

export interface IValidationAdapter {
  /**
   * Validate expert work request.
   */
  validate(request: ValidateExpertWorkRequest): Promise<ValidationResult>;

  /**
   * Batch validate multiple expert reports with queue-aware orchestration.
   */
  validateBatch(request: BatchValidationRequest): Promise<BatchValidationResult>;

  /**
   * Retrieve current validation configuration.
   */
  getConfig(): ValidationConfig;

  /**
   * Update runtime validation configuration.
   */
  updateConfig(config: Partial<ValidationConfig>): ValidationConfig;

  /**
   * Retrieve aggregate validation statistics.
   */
  getStatistics(): ValidationStatistics;
}
