/**
 * Validation Service Adapter Interface
 * 
 * Port interface for research validation
 * Abstracts external ValidationService implementation
 */

export interface ValidationConfig {
  sources: string[];
  findings: string[];
  confidence: number;
  topic: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  checks: {
    sourceCredibility: boolean;
    findingConsistency: boolean;
    confidenceLevel: boolean;
    relevanceScore: boolean;
    duplicationDetected: boolean;
    semanticValidity: boolean;
  };
  feedback: string[];
}

export interface IValidationAdapter {
  /**
   * Validate research data against 6-check pipeline
   */
  validate(config: ValidationConfig): Promise<ValidationResult>;

  /**
   * Batch validate multiple reports
   */
  validateBatch(configs: ValidationConfig[]): Promise<ValidationResult[]>;



  /**
   * Check source credibility
   */
  checkSourceCredibility(sources: string[]): Promise<number>;

  /**
   * Check finding consistency
   */
  checkFindingConsistency(findings: string[]): Promise<boolean>;
}
