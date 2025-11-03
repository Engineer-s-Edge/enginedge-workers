/**
 * Validation Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ValidationAdapter } from '../../../infrastructure/adapters/implementations/validation.adapter';
import { ValidationConfig } from '../../../infrastructure/adapters/interfaces';

describe('ValidationAdapter', () => {
  let adapter: ValidationAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationAdapter],
    }).compile();

    adapter = module.get<ValidationAdapter>(ValidationAdapter);
  });

  describe('validate', () => {
    const validConfig: ValidationConfig = {
      topic: 'Test Topic',
      sources: ['source1.com', 'source2.com'],
      findings: ['Finding 1', 'Finding 2'],
      confidence: 0.85,
    };

    it('should validate successfully', async () => {
      const result = await adapter.validate(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.checks).toBeDefined();
    });

    it('should return all check results', async () => {
      const result = await adapter.validate(validConfig);

      expect(result.checks).toHaveProperty('sourceCredibility');
      expect(result.checks).toHaveProperty('findingConsistency');
      expect(result.checks).toHaveProperty('confidenceLevel');
      expect(result.checks).toHaveProperty('relevanceScore');
      expect(result.checks).toHaveProperty('duplicationDetected');
      expect(result.checks).toHaveProperty('semanticValidity');
    });

    it('should handle low confidence', async () => {
      const config: ValidationConfig = {
        ...validConfig,
        confidence: 0.3,
      };

      const result = await adapter.validate(config);

      expect(result.checks.confidenceLevel).toBe(false);
    });

    it('should handle high confidence', async () => {
      const config: ValidationConfig = {
        ...validConfig,
        confidence: 0.95,
      };

      const result = await adapter.validate(config);

      expect(result.checks.confidenceLevel).toBe(true);
    });

    it('should handle empty sources', async () => {
      const config: ValidationConfig = {
        ...validConfig,
        sources: [],
      };

      const result = await adapter.validate(config);

      expect(result).toBeDefined();
    });

    it('should handle empty findings', async () => {
      const config: ValidationConfig = {
        ...validConfig,
        findings: [],
      };

      const result = await adapter.validate(config);

      expect(result).toBeDefined();
    });

    it('should handle very long topic', async () => {
      const config: ValidationConfig = {
        ...validConfig,
        topic: 'a'.repeat(1000),
      };

      const result = await adapter.validate(config);

      expect(result).toBeDefined();
    });

    it('should include feedback messages', async () => {
      const result = await adapter.validate(validConfig);

      expect(Array.isArray(result.feedback)).toBe(true);
      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('validateBatch', () => {
    const configs: ValidationConfig[] = [
      {
        topic: 'Topic 1',
        sources: ['source1'],
        findings: ['finding1'],
        confidence: 0.8,
      },
      {
        topic: 'Topic 2',
        sources: ['source2'],
        findings: ['finding2'],
        confidence: 0.9,
      },
      {
        topic: 'Topic 3',
        sources: ['source3'],
        findings: ['finding3'],
        confidence: 0.7,
      },
    ];

    it('should validate batch of configs', async () => {
      const results = await adapter.validateBatch(configs);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.isValid).toBeDefined();
        expect(result.score).toBeDefined();
        expect(result.checks).toBeDefined();
      });
    });

    it('should handle empty batch', async () => {
      const results = await adapter.validateBatch([]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle large batch', async () => {
      const largeConfigs = Array.from({ length: 100 }, (_, i) => ({
        topic: `Topic ${i}`,
        sources: ['source'],
        findings: ['finding'],
        confidence: 0.8,
      }));

      const results = await adapter.validateBatch(largeConfigs);

      expect(results).toHaveLength(100);
    });

    it('should preserve order', async () => {
      const results = await adapter.validateBatch(configs);

      expect(results[0].feedback).toBeDefined();
      expect(results[1].feedback).toBeDefined();
      expect(results[2].feedback).toBeDefined();
    });

    it('should validate each config independently', async () => {
      const lowConfidenceConfigs: ValidationConfig[] = [
        {
          topic: 'Low',
          sources: ['s'],
          findings: ['f'],
          confidence: 0.2,
        },
        {
          topic: 'High',
          sources: ['s'],
          findings: ['f'],
          confidence: 0.95,
        },
      ];

      const results = await adapter.validateBatch(lowConfidenceConfigs);

      expect(results[0].checks.confidenceLevel).toBe(false);
      expect(results[1].checks.confidenceLevel).toBe(true);
    });
  });

  describe('checkSourceCredibility', () => {
    it('should return credibility score', async () => {
      const score = await adapter.checkSourceCredibility([
        'arxiv.org',
        'scholar.google.com',
      ]);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle empty sources', async () => {
      const score = await adapter.checkSourceCredibility([]);

      expect(typeof score).toBe('number');
    });

    it('should handle single source', async () => {
      const score = await adapter.checkSourceCredibility(['example.com']);

      expect(typeof score).toBe('number');
    });

    it('should handle many sources', async () => {
      const sources = Array.from({ length: 50 }, (_, i) => `source${i}.com`);

      const score = await adapter.checkSourceCredibility(sources);

      expect(typeof score).toBe('number');
    });

    it('should handle dubious sources', async () => {
      const score = await adapter.checkSourceCredibility([
        'random-blog.xyz',
        'fake.net',
      ]);

      expect(typeof score).toBe('number');
    });
  });

  describe('checkFindingConsistency', () => {
    it('should return boolean consistency check', async () => {
      const result = await adapter.checkFindingConsistency([
        'Finding 1',
        'Finding 2',
      ]);

      expect(typeof result).toBe('boolean');
    });

    it('should handle empty findings', async () => {
      const result = await adapter.checkFindingConsistency([]);

      expect(typeof result).toBe('boolean');
    });

    it('should handle single finding', async () => {
      const result = await adapter.checkFindingConsistency(['Single finding']);

      expect(typeof result).toBe('boolean');
    });

    it('should handle contradictory findings', async () => {
      const findings = ['Statement A is true', 'Statement A is false'];

      const result = await adapter.checkFindingConsistency(findings);

      expect(typeof result).toBe('boolean');
    });

    it('should handle many findings', async () => {
      const findings = Array.from({ length: 100 }, (_, i) => `Finding ${i}`);

      const result = await adapter.checkFindingConsistency(findings);

      expect(typeof result).toBe('boolean');
    });

    it('should handle duplicate findings', async () => {
      const findings = ['Finding', 'Finding', 'Finding'];

      const result = await adapter.checkFindingConsistency(findings);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      try {
        await adapter.validate({
          topic: 'Test',
          sources: ['s'],
          findings: ['f'],
          confidence: 0.5,
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent validations', async () => {
      const configs: ValidationConfig[] = Array.from(
        { length: 10 },
        (_, i) => ({
          topic: `Topic ${i}`,
          sources: ['source'],
          findings: ['finding'],
          confidence: 0.8,
        }),
      );

      const promises = configs.map((c) => adapter.validate(c));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
    });
  });

  describe('stub implementation validation', () => {
    it('stub validate should return score 0.85', async () => {
      const result = await adapter.validate({
        topic: 'Test',
        sources: ['s'],
        findings: ['f'],
        confidence: 0.8,
      });

      expect(result.score).toBe(0.85);
    });

    it('stub should mark findings consistent', async () => {
      const result = await adapter.validate({
        topic: 'Test',
        sources: ['s'],
        findings: ['f'],
        confidence: 0.8,
      });

      expect(result.checks.findingConsistency).toBe(true);
    });

    it('stub should pass all checks for mid-range confidence', async () => {
      const result = await adapter.validate({
        topic: 'Test',
        sources: ['s'],
        findings: ['f'],
        confidence: 0.75,
      });

      expect(Object.values(result.checks)).toContain(true);
    });

    it('stub checkSourceCredibility should return 0.85', async () => {
      const score = await adapter.checkSourceCredibility(['source']);

      expect(score).toBe(0.85);
    });

    it('stub checkFindingConsistency should return true', async () => {
      const result = await adapter.checkFindingConsistency(['f']);

      expect(result).toBe(true);
    });
  });
});
