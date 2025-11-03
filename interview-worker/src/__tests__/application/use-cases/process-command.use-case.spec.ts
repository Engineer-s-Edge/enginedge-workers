/**
 * Process Command Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProcessCommandUseCase } from '../../../application/use-cases/process-command.use-case';
import {
  Command,
  CommandResult,
} from '../../../domain/entities/command.entities';

describe('ProcessCommandUseCase', () => {
  let useCase: ProcessCommandUseCase;
  let mockCommandProcessor: any;
  let mockMessagePublisher: any;

  beforeEach(async () => {
    mockCommandProcessor = {
      processCommand: jest.fn(),
    };

    mockMessagePublisher = {
      publishResult: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessCommandUseCase,
        {
          provide: 'ICommandProcessor',
          useValue: mockCommandProcessor,
        },
        {
          provide: 'IMessagePublisher',
          useValue: mockMessagePublisher,
        },
      ],
    }).compile();

    useCase = module.get<ProcessCommandUseCase>(ProcessCommandUseCase);
  });

  it('should process command and publish result', async () => {
    const mockCommand: Command = {
      taskId: 'task-1',
      type: 'test-command',
      payload: {},
    };

    const mockResult: CommandResult = {
      taskId: 'task-1',
      success: true,
      data: {},
    };

    mockCommandProcessor.processCommand.mockResolvedValue(mockResult);

    const result = await useCase.execute(mockCommand);

    expect(result.success).toBe(true);
    expect(mockCommandProcessor.processCommand).toHaveBeenCalledWith(
      mockCommand,
    );
    expect(mockMessagePublisher.publishResult).toHaveBeenCalledWith(mockResult);
  });

  it('should handle errors gracefully', async () => {
    const mockCommand: Command = {
      taskId: 'task-1',
      type: 'test-command',
      payload: {},
    };

    mockCommandProcessor.processCommand.mockRejectedValue(
      new Error('Processing failed'),
    );

    await expect(useCase.execute(mockCommand)).rejects.toThrow(
      'Processing failed',
    );
  });
});
