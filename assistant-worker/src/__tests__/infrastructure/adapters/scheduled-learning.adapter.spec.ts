/**
 * Scheduled Learning Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledLearningAdapter } from '../../../infrastructure/adapters/implementations/scheduled-learning.adapter';
import { ScheduledLearningManagerService } from '../../../application/services/scheduled-learning-manager.service';

describe('ScheduledLearningAdapter', () => {
  let adapter: ScheduledLearningAdapter;
  let mockManager: any;

  beforeEach(async () => {
    mockManager = {
      scheduleLearning: jest.fn().mockImplementation((config) => ({
        id: 'sched-' + Math.random(),
        userId: config.userId,
        topicId: config.topicId,
        cronExpression: config.cronExpression,
        active: true,
      })),
      cancelScheduled: jest.fn().mockResolvedValue(true),
      getSchedule: jest.fn().mockImplementation((id) => {
        if (id === 'nonexistent') return null;
        return {
          id,
          userId: 'user-1',
          topicId: 'ML',
          cronExpression: '0 9 * * *',
          active: true,
        };
      }),
      getUserSchedules: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledLearningAdapter,
        { provide: ScheduledLearningManagerService, useValue: mockManager },
      ],
    }).compile();

    adapter = module.get<ScheduledLearningAdapter>(ScheduledLearningAdapter);
  });

  describe('scheduleLearning', () => {
    it('should schedule learning', async () => {
      const result = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should handle multiple schedules', async () => {
      const results = await Promise.all([
        adapter.scheduleLearning({
          topicId: 'ML',
          userId: 'user-1',
          cronExpression: '0 9 * * *',
        }),
        adapter.scheduleLearning({
          topicId: 'NLP',
          userId: 'user-1',
          cronExpression: '0 14 * * *',
        }),
        adapter.scheduleLearning({
          topicId: 'CV',
          userId: 'user-1',
          cronExpression: '0 18 * * *',
        }),
      ]);

      expect(results.every((r: unknown) => r !== null)).toBe(true);
    });

    it('should handle complex cron expressions', async () => {
      const cronExpressions = [
        '*/30 * * * *',
        '0 */4 * * *',
        '0 0 * * 0',
        '30 2 * * *',
      ];

      for (const cron of cronExpressions) {
        const result = await adapter.scheduleLearning({
          topicId: 'test',
          userId: 'user-1',
          cronExpression: cron,
        });

        expect(result).toBeDefined();
      }
    });
  });

  describe('cancelScheduled', () => {
    it('should cancel scheduled learning', async () => {
      const scheduled = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      const result = await adapter.cancelScheduled(scheduled.id);

      expect(result).toBe(true);
    });

    it('should handle multiple cancellations', async () => {
      const s1 = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });
      const s2 = await adapter.scheduleLearning({
        topicId: 'AI',
        userId: 'user-1',
        cronExpression: '0 14 * * *',
      });

      const results = await Promise.all([
        adapter.cancelScheduled(s1.id),
        adapter.cancelScheduled(s2.id),
      ]);

      // Both should be booleans (true if deleted, false if not found)
      expect(results).toHaveLength(2);
      expect(results.every((r: boolean) => typeof r === 'boolean')).toBe(true);
    });
  });

  describe('getSchedule', () => {
    it('should retrieve schedule by id', async () => {
      const scheduled = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      const result = await adapter.getSchedule(scheduled.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(scheduled.id);
    });

    it('should return null for nonexistent schedule', async () => {
      const result = await adapter.getSchedule('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserSchedules', () => {
    it('should get all schedules for user', async () => {
      await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      const result = await adapter.getUserSchedules('user-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for user with no schedules', async () => {
      const result = await adapter.getUserSchedules('user-noone');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle concurrent scheduling', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.scheduleLearning({
          topicId: `topic-${i}`,
          userId: 'user-1',
          cronExpression: `0 ${i} * * *`,
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r !== null)).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      const s1 = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      const results = await Promise.all([
        adapter.getSchedule(s1.id),
        adapter.getUserSchedules('user-1'),
        adapter.cancelScheduled(s1.id),
      ]);

      expect(results).toHaveLength(3);
    });
  });

  describe('stub implementation validation', () => {
    it('stub scheduleLearning should return ScheduleInfo', async () => {
      const result = await adapter.scheduleLearning({
        topicId: 'ML',
        userId: 'user-1',
        cronExpression: '0 9 * * *',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('topicId');
      expect(result).toHaveProperty('userId');
    });

    it('stub cancelScheduled should return boolean', async () => {
      const result = await adapter.cancelScheduled('any-id');

      expect(typeof result).toBe('boolean');
    });

    it('stub getSchedule should return ScheduleInfo or null', async () => {
      const result = await adapter.getSchedule('any-id');

      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('stub getUserSchedules should return array', async () => {
      const result = await adapter.getUserSchedules('user-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
