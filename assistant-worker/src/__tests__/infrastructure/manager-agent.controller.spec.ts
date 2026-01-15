import { Test, TestingModule } from '@nestjs/testing';
import { ManagerAgentController } from '../../infrastructure/controllers/manager-agent.controller';
import { AgentService } from '../../application/services/agent.service';
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { ManagerRuntimeService } from '../../application/services/manager/manager-runtime.service';
import { AgentEventService } from '../../application/services/agent-event.service';
import { ManagerAgent } from '../../domain/agents/manager-agent/manager-agent';
import { Agent } from '../../domain/entities/agent.entity';
import { BadRequestException } from '@nestjs/common';

// Mock ManagerAgent prototype to satisfy instanceof checks
const mockManagerAgentPrototype = Object.create(ManagerAgent.prototype);

describe('ManagerAgentController', () => {
    let controller: ManagerAgentController;
    let agentService: jest.Mocked<AgentService>;
    let managerRuntime: jest.Mocked<ManagerRuntimeService>;
    let executeAgentUseCase: jest.Mocked<ExecuteAgentUseCase>;

    const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    const mockAgentId = 'manager-agent-id';
    const mockUserId = 'user-1';

    // Mock Manager Instance
    const mockManagerInstance = Object.assign(Object.create(mockManagerAgentPrototype), {
        id: mockAgentId,
        state: {
            status: 'idle',
            subtasks: [],
            assignments: [],
            aggregatedResults: {}
        },
        getManagerState: jest.fn(),
    });

    const mockAgentEntity = Object.assign(Object.create(Agent.prototype), {
        id: mockAgentId,
        name: 'My Manager',
        agentType: 'manager',
        config: {},
        userId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        mockManagerInstance.getManagerState.mockReturnValue({
            status: 'idle',
        });

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ManagerAgentController],
            providers: [
                {
                    provide: AgentService,
                    useValue: {
                        createAgent: jest.fn(),
                        getAgentInstance: jest.fn(),
                    },
                },
                {
                    provide: ExecuteAgentUseCase,
                    useValue: {
                        execute: jest.fn(),
                    },
                },
                {
                    provide: ManagerRuntimeService,
                    useValue: {
                        decomposeTask: jest.fn(),
                        getSnapshot: jest.fn().mockReturnValue({
                            metrics: {},
                            subtasks: [],
                            assignments: [],
                            aggregatedResult: {},
                            statusHistory: [],
                            decomposition: {},
                            waitingDependencies: [],
                            lastUpdated: new Date()
                        }),
                        getAssignments: jest.fn(),
                        getAssignment: jest.fn(),
                        reassignAssignment: jest.fn(),
                        aggregateResults: jest.fn(),
                    },
                },
                {
                    provide: AgentEventService,
                    useValue: {
                        emit: jest.fn(),
                    },
                },
                {
                    provide: 'ILogger',
                    useValue: mockLogger,
                },
            ],
        }).compile();

        controller = module.get<ManagerAgentController>(ManagerAgentController);
        agentService = module.get(AgentService);
        managerRuntime = module.get(ManagerRuntimeService);
        executeAgentUseCase = module.get(ExecuteAgentUseCase);
    });

    describe('createManagerAgent', () => {
        it('should create a manager agent', async () => {
            (agentService.createAgent as jest.Mock).mockResolvedValue(mockAgentEntity);

            const result = await controller.createManagerAgent({
                name: 'My Manager',
                userId: mockUserId
            });

            expect(agentService.createAgent).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'My Manager', agentType: 'manager' }),
                mockUserId
            );
            expect(result).toMatchObject({
                id: mockAgentId,
                type: 'manager'
            });
        });
    });

    describe('decomposeTask', () => {
        it('should decompose task using runtime service', async () => {
            (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockManagerInstance);
            (managerRuntime.decomposeTask as jest.Mock).mockReturnValue({
                subtasks: [{
                    id: 'sub-1',
                    title: 'Subtask 1',
                    status: 'pending',
                    progress: 0,
                    lastUpdated: new Date(),
                    dependencies: [],
                    complexity: 'medium',
                    priority: 'medium',
                    description: 'Do it',
                    estimatedDuration: 60
                }],
                decomposition: { decompositionId: 'd-1', rationale: 'test', confidence: 0.9 },
                generatedAt: new Date(),
                strategy: 'sequential',
                masterTask: { title: 'Do big project' },
                metrics: { completionRate: 0.5, successRate: 0.8, averageTaskDuration: 100 },
                executionPlan: {
                    planId: 'plan-1',
                    strategy: 'sequential',
                    estimatedDuration: 100,
                    assignments: [{
                        id: 'assign-1',
                        subtaskId: 'sub-1',
                        agentId: 'worker-1',
                        status: 'pending',
                        assignedAt: new Date()
                    }]
                }
            });

            const body = {
                userId: mockUserId,
                masterTask: 'Do big project',
            };

            const result = await controller.decomposeTask(mockAgentId, body);

            expect(agentService.getAgentInstance).toHaveBeenCalledWith(mockAgentId, mockUserId);
            expect(managerRuntime.decomposeTask).toHaveBeenCalled();
            expect(result.subtasks).toHaveLength(1);
        });
    });

    describe('getManagerState', () => {
        it('should return manager state', async () => {
            (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockManagerInstance);
            (managerRuntime.getSnapshot as jest.Mock).mockReturnValue({
                metrics: { completed: 10 },
                subtasks: [],
                assignments: [],
                aggregatedResult: {},
                statusHistory: [],
                decomposition: {},
                waitingDependencies: [],
                lastUpdated: new Date()
            });

            const result = await controller.getManagerState(mockAgentId, mockUserId);

            expect(result.agentId).toBe(mockAgentId);
            expect(result.runtime).toBeDefined();
            expect(managerRuntime.getSnapshot).toHaveBeenCalledWith(mockAgentId);
        });

        it('should throw BadRequest if agent is not a manager', async () => {
            const mockWorkerInstance = {
                ...mockAgentEntity,
                type: 'worker',
            };
            (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockWorkerInstance);

            await expect(controller.getManagerState(mockAgentId, mockUserId))
                .rejects
                .toThrow(BadRequestException);
        });
    });

    describe('reassignTask', () => {
        const mockReassignBody = {
            userId: mockUserId,
            assignmentId: 'assignment-1',
            targetAgentId: 'agent-2',
            reason: 'Overload',
        };

        it('should reassign task successfully', async () => {
            (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockManagerInstance);
            (managerRuntime.reassignAssignment as jest.Mock).mockReturnValue(undefined);

            const result = await controller.reassignTask(mockAgentId, mockReassignBody);

            expect(managerRuntime.reassignAssignment).toHaveBeenCalledWith(
                mockAgentId,
                mockUserId,
                mockReassignBody.assignmentId,
                mockReassignBody.targetAgentId
            );
            expect(result.success).toBe(true);
            expect(result.assignmentId).toBe(mockReassignBody.assignmentId);
        });

        it('should throw BadRequest if assignmentId is missing', async () => {
             const invalidBody = { ...mockReassignBody };
             delete (invalidBody as any).assignmentId;

            await expect(controller.reassignTask(mockAgentId, invalidBody as any))
                .rejects
                .toThrow(BadRequestException);
        });
    });
});
