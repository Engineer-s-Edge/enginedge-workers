/**
 * Learning Mode Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LearningModeAdapter } from '../../../infrastructure/adapters/implementations/learning-mode.adapter';
import { LearningModeService } from '../../../application/services/learning-mode.service';
import {
  LearningMode,
  LearningModeConfig,
} from '../../../infrastructure/adapters/interfaces/learning-mode.adapter.interface';

describe('LearningModeAdapter', () => {
  let adapter: LearningModeAdapter;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      getModeStatistics: jest.fn().mockResolvedValue({
        mode: 'user-directed',
        usageCount: 1,
        successRate: 1,
      }),
      isLearning: jest.fn().mockResolvedValue(false),
      switchMode: jest.fn().mockResolvedValue(true),
      cancelLearning: jest.fn().mockResolvedValue(true),
      executeLearningMode: jest.fn().mockImplementation((config) => ({
        success: true,
        mode: config.mode,
        topicsProcessed: ['topic1'],
        duration: 123,
        timestamp: new Date(),
      })),
      getCurrentMode: jest.fn().mockResolvedValue('user-directed'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningModeAdapter,
        { provide: LearningModeService, useValue: mockService },
      ],
    }).compile();

    adapter = module.get<LearningModeAdapter>(LearningModeAdapter);
  });

  describe('executeLearningMode', () => {
    it('should execute user-directed learning mode', async () => {
      const config: LearningModeConfig = {
        userId: 'user-1',
        mode: 'user-directed',
        topics: ['ML', 'AI'],
      };

      const result = await adapter.executeLearningMode(config);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('user-directed');
    });

    it('should execute autonomous learning mode', async () => {
      const config: LearningModeConfig = {
        userId: 'user-2',
        mode: 'autonomous',
        detectedGaps: [{ topic: 'NLP', gapScore: 0.8 }],
      };

      const result = await adapter.executeLearningMode(config);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('autonomous');
    });

    it('should execute scheduled learning mode', async () => {
      const config: LearningModeConfig = {
        userId: 'user-3',
        mode: 'scheduled',
        cronSchedule: '0 9 * * *',
      };

      const result = await adapter.executeLearningMode(config);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('scheduled');
    });

    it('should include metadata in result', async () => {
      const config: LearningModeConfig = {
        userId: 'user-4',
        mode: 'user-directed',
        topics: ['Python', 'Data Science'],
      };

      const result = await adapter.executeLearningMode(config);

      expect(result).toHaveProperty('topicsProcessed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle concurrent executions', async () => {
      const configs: LearningModeConfig[] = Array.from(
        { length: 10 },
        (_, i) => ({
          userId: `user-${i}`,
          mode: 'user-directed' as LearningMode,
          topics: [`Topic-${i}`],
        }),
      );

      const results = await Promise.all(
        configs.map((c) => adapter.executeLearningMode(c)),
      );

      expect(results).toHaveLength(10);
      results.forEach((r) => {
        expect(r.success).toBe(true);
      });
    });
  });

  describe('getCurrentMode', () => {
    it('should get current mode for user', async () => {
      const mode = await adapter.getCurrentMode('user-1');

      expect(
        mode === null ||
          mode === 'user-directed' ||
          mode === 'autonomous' ||
          mode === 'scheduled',
      ).toBe(true);
    });

    it('should handle multiple users', async () => {
      const modes = await Promise.all([
        adapter.getCurrentMode('user-1'),
        adapter.getCurrentMode('user-2'),
        adapter.getCurrentMode('user-3'),
      ]);

      expect(modes).toHaveLength(3);
    });
  });

  describe('switchMode', () => {
    it('should switch from user-directed to autonomous', async () => {
      const result = await adapter.switchMode('user-1', 'autonomous');

      expect(result).toBe(true);
    });

    it('should switch to scheduled mode', async () => {
      const result = await adapter.switchMode('user-2', 'scheduled');

      expect(result).toBe(true);
    });

    it('should handle multiple mode switches', async () => {
      const switches = [
        adapter.switchMode('user-1', 'user-directed'),
        adapter.switchMode('user-1', 'autonomous'),
        adapter.switchMode('user-1', 'scheduled'),
      ];

      const results = await Promise.all(switches);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should handle concurrent switches', async () => {
      const switches = Array.from({ length: 15 }, (_, i) => {
        const modes: LearningMode[] = [
          'user-directed',
          'autonomous',
          'scheduled',
        ];
        return adapter.switchMode(`user-${i}`, modes[i % 3]);
      });

      const results = await Promise.all(switches);

      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe('getModeStatistics', () => {
    it('should get statistics for user-directed mode', async () => {
      const stats = await adapter.getModeStatistics('user-directed');

      expect(typeof stats).toBe('object');
    });

    it('should get statistics for autonomous mode', async () => {
      const stats = await adapter.getModeStatistics('autonomous');

      expect(stats).toHaveProperty('mode');
      expect(stats).toHaveProperty('usageCount');
      expect(stats).toHaveProperty('successRate');
    });

    it('should get statistics for scheduled mode', async () => {
      const stats = await adapter.getModeStatistics('scheduled');

      expect(typeof stats).toBe('object');
    });

    it('should handle concurrent requests', async () => {
      const modes: LearningMode[] = [
        'user-directed',
        'autonomous',
        'scheduled',
      ];

      const promises = modes.flatMap((mode) =>
        Array.from({ length: 5 }, () => adapter.getModeStatistics(mode)),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(15);
    });
  });

  describe('isLearning', () => {
    it('should return boolean for active user', async () => {
      const result = await adapter.isLearning('user-1');

      expect(typeof result).toBe('boolean');
    });

    it('should handle multiple users', async () => {
      const results = await Promise.all([
        adapter.isLearning('user-1'),
        adapter.isLearning('user-2'),
        adapter.isLearning('user-3'),
      ]);

      expect(results.every((r) => typeof r === 'boolean')).toBe(true);
    });
  });

  describe('cancelLearning', () => {
    it('should cancel learning for user', async () => {
      const result = await adapter.cancelLearning('user-1');

      expect(result).toBe(true);
    });

    it('should handle multiple cancellations', async () => {
      const results = await Promise.all([
        adapter.cancelLearning('user-1'),
        adapter.cancelLearning('user-2'),
        adapter.cancelLearning('user-3'),
      ]);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should handle concurrent cancellations', async () => {
      const cancellations = Array.from({ length: 20 }, (_, i) =>
        adapter.cancelLearning(`user-${i}`),
      );

      const results = await Promise.all(cancellations);

      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle rapid mode changes', async () => {
      const modes: LearningMode[] = [
        'autonomous',
        'scheduled',
        'user-directed',
      ];
      const changes = [];

      for (let i = 0; i < 20; i++) {
        changes.push(adapter.switchMode('user-rapid', modes[i % 3]));
      }

      const results = await Promise.all(changes);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should handle execution with all options', async () => {
      const config: LearningModeConfig = {
        userId: 'user-full',
        mode: 'scheduled',
        topics: ['AI', 'ML', 'DL'],
        detectedGaps: [
          { topic: 'NLP', gapScore: 0.7 },
          { topic: 'CV', gapScore: 0.6 },
        ],
        cronSchedule: '0 9 * * *',
      };

      const result = await adapter.executeLearningMode(config);

      expect(result.success).toBe(true);
    });

    it('should handle mixed concurrent operations', async () => {
      const ops = [
        adapter.executeLearningMode({
          userId: 'user-x',
          mode: 'user-directed',
        }),
        adapter.getCurrentMode('user-x'),
        adapter.switchMode('user-x', 'autonomous'),
        adapter.getModeStatistics('user-directed'),
        adapter.isLearning('user-x'),
        adapter.cancelLearning('user-x'),
      ];

      const results = await Promise.all(ops);

      expect(results).toHaveLength(6);
    });
  });

  describe('stub implementation validation', () => {
    it('stub executeLearningMode should return result', async () => {
      const result = await adapter.executeLearningMode({
        userId: 'user-1',
        mode: 'user-directed',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('topicsProcessed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('timestamp');
    });

    it('stub getCurrentMode should return valid value', async () => {
      const result = await adapter.getCurrentMode('user-1');

      expect(
        result === null ||
          result === 'user-directed' ||
          result === 'autonomous' ||
          result === 'scheduled',
      ).toBe(true);
    });

    it('stub switchMode should return boolean', async () => {
      const result = await adapter.switchMode('user-1', 'autonomous');

      expect(typeof result).toBe('boolean');
    });

    it('stub getModeStatistics should return object', async () => {
      const result = await adapter.getModeStatistics('user-directed');

      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('usageCount');
      expect(result).toHaveProperty('successRate');
    });

    it('stub isLearning should return boolean', async () => {
      const result = await adapter.isLearning('user-1');

      expect(typeof result).toBe('boolean');
    });

    it('stub cancelLearning should return boolean', async () => {
      const result = await adapter.cancelLearning('user-1');

      expect(typeof result).toBe('boolean');
    });
  });
});
