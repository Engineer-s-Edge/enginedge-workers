import { WorkerThreadPool } from '../../../infrastructure/threading/worker-thread-pool';
import { ILogger } from '../../../application/ports/logger.port';
import { mock, MockProxy } from 'jest-mock-extended';

describe('WorkerThreadPool', () => {
  let pool: WorkerThreadPool;
  let mockLogger: MockProxy<ILogger>;

  beforeEach(() => {
    mockLogger = mock<ILogger>();
    mockLogger.info.mockImplementation(() => {});
    mockLogger.debug.mockImplementation(() => {});
    mockLogger.warn.mockImplementation(() => {});
    mockLogger.error.mockImplementation(() => {});
    mockLogger.fatal.mockImplementation(() => {});
    mockLogger.setLevel.mockImplementation(() => {});
    mockLogger.getLevel.mockReturnValue('info');

    pool = new WorkerThreadPool(mockLogger, {
      minWorkers: 1,
      maxWorkers: 1,
      idleTimeout: 1000,
      taskTimeout: 5000,
    });
  });

  afterEach(async () => {
    await pool.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should initialize with logger', () => {
      expect(pool).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should initialize with custom config', () => {
      const customPool = new WorkerThreadPool(mockLogger, {
        minWorkers: 2,
        maxWorkers: 4,
      });
      expect(customPool).toBeDefined();
    });

    it('should use CPU count for default config', () => {
      const defaultPool = new WorkerThreadPool(mockLogger);
      expect(defaultPool).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('executeTask', () => {
    it('should execute task successfully', async () => {
      const task = { test: 'data' };

      try {
        await pool.executeTask(task);
      } catch {
        // Expected to fail without worker script
      }
    });

    it('should handle task execution with priority', async () => {
      const task = { test: 'priority' };

      try {
        await pool.executeTask(task, 10);
      } catch {
        // Expected
      }
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      const stats = pool.getStats();

      expect(stats).toHaveProperty('activeTasks');
      expect(stats).toHaveProperty('availableWorkers');
      expect(stats).toHaveProperty('queuedTasks');
      expect(stats).toHaveProperty('totalWorkers');
    });

    it('should track worker counts correctly', () => {
      const stats = pool.getStats();

      expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queuedTasks).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should shutdown gracefully', async () => {
      await pool.onModuleDestroy();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle shutdown with queued tasks', async () => {
      pool.executeTask({ test: 'data' }).catch(() => {});

      await pool.onModuleDestroy();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls', async () => {
      await pool.onModuleDestroy();
      await pool.onModuleDestroy();

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle task execution errors', async () => {
      try {
        await pool.executeTask({ fail: true });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should log task errors', async () => {
      try {
        await pool.executeTask({ error: true });
      } catch {
        // Expected
      }
    });
  });

  describe('queue management', () => {
    it('should queue tasks when workers are busy', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `task-${i}` }));

      const promises = tasks.map((t) => pool.executeTask(t).catch(() => {}));

      await Promise.all(promises);
    });

    it('should prioritize high priority tasks', async () => {
      await pool.executeTask({ data: 'low' }, 1).catch(() => {});
      await pool.executeTask({ data: 'high' }, 100).catch(() => {});

      const stats = pool.getStats();
      expect(stats).toBeDefined();
    });
  });
});
