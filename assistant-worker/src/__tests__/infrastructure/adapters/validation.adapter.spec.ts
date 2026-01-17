import { Test, TestingModule } from '@nestjs/testing';
import { ValidationAdapter } from '../../../infrastructure/adapters/implementations/validation.adapter';
import { ValidationService } from '../../../application/services/validation.service';
import {
  BatchValidationRequest,
  BatchValidationResult,
  ValidateExpertWorkRequest,
  ValidationConfig,
  ValidationResult,
  ValidationStatistics,
  ValidationCheckType,
  ValidationSeverity,
} from '@domain/validation/validation.types';

describe('ValidationAdapter', () => {
  let adapter: ValidationAdapter;
  let service: jest.Mocked<ValidationService>;

  const createResult = (
    overrides: Partial<ValidationResult> = {},
  ): ValidationResult => ({
    id: 'result-1',
    expertId: 'expert-1',
    reportId: 'report-1',
    topic: 'Test',
    validatedAt: new Date(),
    validationDurationMs: 10,
    status: 'passed',
    score: 0.9,
    coverageScore: 0.8,
    completenessScore: 0.85,
    issues: [],
    issuesBySeverity: {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    },
    checks: {},
    requiresManualReview: false,
    metadata: {},
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationAdapter,
        {
          provide: ValidationService,
          useValue: {
            validateExpertWork: jest.fn(),
            validateBatch: jest.fn(),
            getConfig: jest.fn(),
            updateConfig: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<ValidationAdapter>(ValidationAdapter);
    service = module.get(ValidationService);
  });

  it('delegates validate() to ValidationService', async () => {
    const request: ValidateExpertWorkRequest = {
      expertReport: {
        reportId: 'r1',
        expertId: 'e1',
        topic: 'Topic',
        findings: ['Finding'],
        sources: ['https://example.com'],
        confidence: 0.8,
      },
    };
    const expected = createResult();
    service.validateExpertWork.mockResolvedValue(expected);

    const result = await adapter.validate(request);

    expect(result).toEqual(expected);
    expect(service.validateExpertWork).toHaveBeenCalledWith(request);
  });

  it('delegates validateBatch() to ValidationService', async () => {
    const request: BatchValidationRequest = {
      expertReports: [
        {
          reportId: 'r1',
          expertId: 'e1',
          topic: 'Topic',
          findings: ['one'],
          sources: ['https://example.com'],
          confidence: 0.7,
        },
      ],
    };
    const expected: BatchValidationResult = {
      total: 1,
      passed: 1,
      failed: 0,
      elapsedMs: 5,
      results: [createResult()],
    };
    service.validateBatch.mockResolvedValue(expected);

    const result = await adapter.validateBatch(request);

    expect(result).toEqual(expected);
    expect(service.validateBatch).toHaveBeenCalledWith(request);
  });

  it('returns current config via getConfig()', () => {
    const config: ValidationConfig = {
      enabledChecks: [],
      minConfidenceThreshold: 0.5,
      autoFixEnabled: true,
      blockingSeverity: ValidationSeverity.ERROR,
      useValidatorAgents: false,
      timeoutMs: 1000,
      coverageTarget: 0.75,
      applyBiasHeuristics: true,
    };
    service.getConfig.mockReturnValue(config);

    const response = adapter.getConfig();

    expect(response).toEqual(config);
    expect(service.getConfig).toHaveBeenCalled();
  });

  it('updates config via updateConfig()', () => {
    const updated: ValidationConfig = {
      enabledChecks: [],
      minConfidenceThreshold: 0.5,
      autoFixEnabled: false,
      blockingSeverity: ValidationSeverity.ERROR,
      useValidatorAgents: true,
      timeoutMs: 1000,
      coverageTarget: 0.7,
      applyBiasHeuristics: false,
    };
    service.updateConfig.mockReturnValue(updated);

    const result = adapter.updateConfig({ autoFixEnabled: false });

    expect(result).toEqual(updated);
    expect(service.updateConfig).toHaveBeenCalledWith({
      autoFixEnabled: false,
    });
  });

  it('exposes validation statistics', () => {
    const stats: ValidationStatistics = {
      totalValidations: 10,
      passRate: 80,
      averageScore: 0.86,
      autoFixSuccessRate: 70,
      issuesByType: Object.values(ValidationCheckType).reduce(
        (acc, type) => ({ ...acc, [type]: 0 }),
        {} as Record<ValidationCheckType, number>,
      ),
      issuesBySeverity: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      },
      averageDurationMs: 1200,
      lastUpdated: new Date(),
    };
    service.getStatistics.mockReturnValue(stats);

    expect(adapter.getStatistics()).toEqual(stats);
    expect(service.getStatistics).toHaveBeenCalled();
  });
});
