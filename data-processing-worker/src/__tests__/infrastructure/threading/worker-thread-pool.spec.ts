import { WorkerThreadPool } from '@infrastructure/threading/worker-thread-pool';
import { ILogger } from '@application/ports/logger.port';
import { mock, MockProxy } from 'jest-mock-extended';

describe('WorkerThreadPool', () => {
  it('executes a task and returns result', async () => {
    const loggerStub: MockProxy<ILogger> = mock<ILogger>();
    // Provide no-op implementations where necessary
    loggerStub.info.mockImplementation(() => {});
    loggerStub.debug.mockImplementation(() => {});
    loggerStub.warn.mockImplementation(() => {});
    loggerStub.error.mockImplementation(() => {});
    loggerStub.fatal.mockImplementation(() => {});
    loggerStub.setLevel.mockImplementation(() => {});
    loggerStub.getLevel.mockReturnValue('info');

    const pool = new WorkerThreadPool(loggerStub, { minWorkers: 1, maxWorkers: 1, idleTimeout: 1000, taskTimeout: 5000 });

    const result = await pool.executeTask({ foo: 'bar' }, 0);
    expect(result).toBeDefined();
    expect((result as unknown as { completed: boolean }).completed).toBeTruthy();

    // cleanup
    await pool.onModuleDestroy();
  }, 20000);
});
