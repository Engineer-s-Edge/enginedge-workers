/**
 * Command Application Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandApplicationService } from '../../../application/services/command-application.service';
import { ProcessCommandUseCase } from '../../../application/use-cases/process-command.use-case';

describe('CommandApplicationService', () => {
  let service: CommandApplicationService;
  let mockProcessCommandUseCase: any;

  beforeEach(async () => {
    mockProcessCommandUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandApplicationService,
        {
          provide: ProcessCommandUseCase,
          useValue: mockProcessCommandUseCase,
        },
      ],
    }).compile();

    service = module.get<CommandApplicationService>(CommandApplicationService);
  });

  it('should process command', async () => {
    const mockCommand: Command = {
      taskId: 'task-1',
      taskType: 'EXECUTE_ASSISTANT',
      payload: {},
    };

    const mockResult: CommandResult = {
      taskId: 'task-1',
      status: 'SUCCESS',
      result: {},
    };

    mockProcessCommandUseCase.execute.mockResolvedValue(mockResult);

    const result = await service.processCommand(mockCommand);

    expect(result.status).toBe('SUCCESS');
    expect(mockProcessCommandUseCase.execute).toHaveBeenCalledWith(mockCommand);
  });
});

