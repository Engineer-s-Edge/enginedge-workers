/**
 * Interview Entity Unit Tests
 */

import { Interview } from '../../../domain/entities/interview.entity';

describe('Interview Entity', () => {
  it('should create interview with required fields', () => {
    const interview = new Interview({
      id: 'test-id',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: {
        overall: {
          weights: {},
        },
      },
    });

    expect(interview.id).toBe('test-id');
    expect(interview.title).toBe('Test Interview');
    expect(interview.phases).toEqual([]);
    expect(interview.config.allowPause).toBe(true);
  });

  it('should convert to object for MongoDB', () => {
    const interview = new Interview({
      id: 'test-id',
      title: 'Test Interview',
      phases: [
        {
          phaseId: 'phase-1',
          type: 'technical',
          duration: 30,
          difficulty: 'medium',
          questionCount: 3,
        },
      ],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: {
        overall: {
          weights: {
            technical: 0.6,
          },
        },
      },
    });

    const obj = interview.toObject();
    expect(obj.id).toBe('test-id');
    expect(obj.title).toBe('Test Interview');
    expect(Array.isArray(obj.phases)).toBe(true);
  });

  it('should create from MongoDB object', () => {
    const data = {
      id: 'test-id',
      title: 'Test Interview',
      description: 'Test description',
      phases: [
        {
          phaseId: 'phase-1',
          type: 'technical',
          duration: 30,
          difficulty: 'medium',
          questionCount: 3,
        },
      ],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: {
        overall: {
          weights: {
            technical: 0.6,
          },
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const interview = Interview.fromObject(data);
    expect(interview.id).toBe('test-id');
    expect(interview.title).toBe('Test Interview');
    expect(interview.phases).toHaveLength(1);
  });

  it('should handle optional fields', () => {
    const interview = new Interview({
      id: 'test-id',
      title: 'Test Interview',
      description: 'Optional description',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: {
        overall: {
          weights: {},
        },
      },
    });

    expect(interview.description).toBe('Optional description');
  });
});
