describe('AgentExecutionService (smoke)', () => {
  it('should construct without crashing (smoke)', () => {
    // Minimal mock objects
    const mockAgentService: any = {
      getAgent: jest.fn().mockResolvedValue({ agentType: 'react' }),
      getAgentInstance: jest.fn().mockResolvedValue({
        execute: jest
          .fn()
          .mockResolvedValue({ status: 'success', output: 'ok' }),
        stream: async function* () {
          yield 'ok';
        },
        abort: jest.fn(),
      }),
    };

    const mockEvents: any = { emitEvent: jest.fn() };
    const mockSessions: any = {
      createSession: jest.fn().mockReturnValue({ sessionId: 's1' }),
      updateSessionStatus: jest.fn(),
      updateSessionActivity: jest.fn(),
      getAgentSessions: jest.fn().mockReturnValue([]),
    };

    const mockLogger: any = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    // Lazy import to avoid dependency graph in test environment
    const { AgentExecutionService } = require('../agent-execution.service');

    const svc = new AgentExecutionService(
      mockAgentService,
      mockEvents,
      mockSessions,
      mockLogger,
      undefined,
    );

    expect(svc).toBeDefined();
  });
});
