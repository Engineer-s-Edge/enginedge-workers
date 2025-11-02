/**
 * Agent Factory Service
 * 
 * Responsible for creating agents with proper type initialization and capability assignment.
 * Encapsulates agent creation logic and type-specific setup.
 */

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { ILLMProvider } from '@application/ports/llm-provider.port';
import { Agent } from '../entities/agent.entity';
import { BaseAgent } from '../agents/agent.base';
import { ReActAgent } from '../agents/react-agent/react-agent';
import { GraphAgent } from '../agents/graph-agent/graph-agent';
import { ExpertAgent } from '../agents/expert-agent/expert-agent';
import { GeniusAgent } from '../agents/genius-agent/genius-agent';
import { CollectiveAgent } from '../agents/collective-agent/collective-agent';
import { ManagerAgent } from '../agents/manager-agent/manager-agent';
import { InterviewAgent } from '../agents/interview-agent';
import { MemoryManager } from '../services/memory-manager.service';
import { StateMachineService } from '../services/state-machine.service';
import { ResponseParser } from '../services/response-parser.service';
import { PromptBuilder } from '../services/prompt-builder.service';

/**
 * AgentFactory - Factory for creating agent instances
 * 
 * Responsibilities:
 * - Create agent instances of all types
 * - Dependency injection for agent dependencies
 * - Configuration validation
 * - Initialization
 */
@Injectable()
export class AgentFactory {
  // Note: StateMachineService is not injected as instance because agents need the class constructor
  // Agents use: new StateMachine(...) for their own state management
  
  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
    private readonly memoryManager: MemoryManager,
    private readonly responseParser: ResponseParser,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  /**
   * Create agent instance from agent definition
   */
  createInstance(agent: Agent): BaseAgent {
    try {
      this.logger.debug('Creating agent instance', { agentId: agent.id, type: agent.agentType });

      switch (agent.agentType) {
        case 'react':
          return this.createReActAgent(agent);
        case 'graph':
          return this.createGraphAgent(agent);
        case 'expert':
          return this.createExpertAgent(agent);
        case 'genius':
          return this.createGeniusAgent(agent);
        case 'collective':
          return this.createCollectiveAgent(agent);
        case 'manager':
          return this.createManagerAgent(agent);
        case 'interview':
          return this.createInterviewAgent(agent);
        default:
          throw new BadRequestException(`Unknown agent type: ${agent.agentType}`);
      }
    } catch (error) {
      this.logger.error('Failed to create agent instance', { error, agentId: agent.id, type: agent.agentType });
      throw error;
    }
  }

  /**
   * Create ReAct agent (Reasoning + Acting)
   * Best for: Conversational tasks with tool use
   */
  private createReActAgent(agent: Agent): ReActAgent {
    const config = {
      maxIterations: 10,
      temperature: agent.config.temperature || 0.7,
      model: agent.config.model,
      systemPrompt: agent.config.systemPrompt || this.getDefaultSystemPrompt('react'),
      tools: [],
    };

    return new ReActAgent(
      this.llmProvider,
      this.logger,
      this.memoryManager,
      StateMachineService,
      this.responseParser,
      this.promptBuilder,
      config,
    );
  }

  /**
   * Create Graph agent (DAG-based workflows)
   * Best for: Complex workflows with conditional logic
   */
  private createGraphAgent(agent: Agent): GraphAgent {
    const config = {
      maxDepth: 20,
      allowParallel: true,
      temperature: agent.config.temperature || 0.5,
      model: agent.config.model,
    };

    return new GraphAgent(
      this.llmProvider,
      this.logger,
      this.memoryManager,
      StateMachineService,
      this.responseParser,
      this.promptBuilder,
      config,
    );
  }

  /**
   * Create Expert agent (Research-focused)
   * Uses ICS Bear Hunter methodology: AIM → SHOOT → SKIN
   * Best for: Deep research tasks
   */
  private createExpertAgent(agent: Agent): ExpertAgent {
    const config = {
      aim_iterations: 3,
      shoot_iterations: 5,
      skin_model: 'gpt-4',
      temperature: agent.config.temperature || 0.3,
      model: agent.config.model,
    };

    return new ExpertAgent(
      this.llmProvider,
      this.logger,
      undefined, // ragAdapter - will be injected when needed
      config,
    );
  }

  /**
   * Create Genius agent (Meta-learning orchestrator)
   * Commands multiple Expert agents
   * Best for: Autonomous learning systems
   */
  private createGeniusAgent(agent: Agent): GeniusAgent {
    const config = {
      expertPoolSize: 5,
      learningModes: ['supervised', 'unsupervised', 'reinforcement'],
      qualityThreshold: 0.8,
      temperature: agent.config.temperature || 0.5,
      model: agent.config.model,
    };

    return new GeniusAgent(
      this.llmProvider,
      this.logger,
      config,
    );
  }

  /**
   * Create Collective agent (Multi-agent team orchestration)
   * Simulates organizational structure with PM coordination
   * Best for: Large-scale coordination tasks
   */
  private createCollectiveAgent(agent: Agent): CollectiveAgent {
    const config = {
      maxSubAgents: 10,
      temperature: agent.config.temperature || 0.6,
      model: agent.config.model,
    };

    return new CollectiveAgent(
      this.llmProvider,
      this.logger,
      config,
    );
  }

  /**
   * Create Manager agent (Task decomposition)
   * Breaks down tasks and coordinates sub-agents
   * Best for: Task delegation patterns
   */
  private createManagerAgent(agent: Agent): ManagerAgent {
    const config = {
      maxSubtasks: 10,
      temperature: agent.config.temperature || 0.6,
      model: agent.config.model,
    };

    return new ManagerAgent(
      this.llmProvider,
      this.logger,
      this.memoryManager,
      StateMachineService,
      this.responseParser,
      this.promptBuilder,
      config,
    );
  }

  /**
   * Create Interview agent
   * Best for: Conducting mock interviews
   */
  private createInterviewAgent(agent: Agent): InterviewAgent {
    const config = {
      interviewWorkerBaseUrl: agent.config.interviewWorkerBaseUrl || process.env.INTERVIEW_WORKER_URL || 'http://localhost:3004',
      sessionId: agent.config.sessionId || '',
      interviewId: agent.config.interviewId || '',
      candidateId: agent.config.candidateId || '',
      temperature: agent.config.temperature || 0.7,
      model: agent.config.model || 'gpt-4',
      difficulty: agent.config.difficulty || 'medium',
      communicationMode: agent.config.communicationMode || 'text',
    };

    return new InterviewAgent(
      this.llmProvider,
      this.logger,
      config,
    );
  }

  /**
   * Get default system prompt by agent type
   */
  private getDefaultSystemPrompt(type: string): string {
    const prompts: Record<string, string> = {
      react: `You are a helpful AI assistant. Use the following format for your responses:
        Thought: (your reasoning)
        Action: (action to take or "Final Answer")
        Action Input: (input for the action)
        Observation: (result of the action)
        ... (repeat Thought/Action/Observation as needed)
        Final Answer: (final response)`,
      graph: `You are an AI assistant skilled at breaking down complex tasks into steps and workflows. Follow the provided workflow graph and execute each node according to its requirements.`,
      expert: `You are an expert researcher. Use the AIM-SHOOT-SKIN methodology:
        AIM: Understand the research question and identify key concepts
        SHOOT: Conduct deep research from multiple sources
        SKIN: Synthesize findings into a comprehensive answer`,
      genius: `You are a meta-learning orchestrator. Your role is to coordinate expert agents to learn and build knowledge systematically.`,
      collective: `You are a Project Manager agent coordinating a team of specialists. Delegate tasks efficiently and track progress.`,
      manager: `You are a task management agent. Break down complex tasks into subtasks and coordinate their execution.`,
    };

    return prompts[type] || 'You are a helpful AI assistant.';
  }

  /**
   * Validate agent configuration
   */
  validateConfig(type: string, config: Record<string, any>): boolean {
    const requiredFields: Record<string, string[]> = {
      react: ['model'],
      graph: ['model'],
      expert: ['model'],
      genius: ['model'],
      collective: ['pmModel', 'workerModel'],
      manager: ['model'],
    };

    const required = requiredFields[type] || [];

    for (const field of required) {
      if (!config[field]) {
        this.logger.warn('Missing required config field', { type, field });
        return false;
      }
    }

    return true;
  }

  /**
   * Get agent type metadata
   */
  getAgentTypeMetadata(type: string) {
    const metadata: Record<string, any> = {
      react: {
        name: 'ReAct Agent',
        description: 'Reasoning + Acting agent with tool use',
        bestFor: 'Conversational tasks, problem-solving',
        complexity: 'Medium',
        maxIterations: 10,
      },
      graph: {
        name: 'Graph Agent',
        description: 'DAG-based workflow execution',
        bestFor: 'Complex workflows, conditional logic',
        complexity: 'High',
        maxDepth: 20,
      },
      expert: {
        name: 'Expert Agent',
        description: 'Research-focused with AIM-SHOOT-SKIN methodology',
        bestFor: 'Deep research, knowledge synthesis',
        complexity: 'Very High',
        phases: ['aim', 'shoot', 'skin'],
      },
      genius: {
        name: 'Genius Agent',
        description: 'Meta-learning orchestrator commanding expert pool',
        bestFor: 'Autonomous learning systems',
        complexity: 'Very High',
        modes: ['user-directed', 'autonomous', 'scheduled'],
      },
      collective: {
        name: 'Collective Agent',
        description: 'Multi-agent team orchestration',
        bestFor: 'Large-scale coordination, team tasks',
        complexity: 'Very High',
        teamRoles: ['pm', 'specialist'],
      },
      manager: {
        name: 'Manager Agent',
        description: 'Task decomposition and coordination',
        bestFor: 'Task delegation, sub-agent coordination',
        complexity: 'High',
        maxSubtasks: 10,
      },
    };

    return metadata[type] || {};
  }
}
