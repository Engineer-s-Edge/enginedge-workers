/**
 * Assistant Executor Service
 *
 * Application layer service for executing assistants
 * Bridges Assistant entities to Agent execution
 */

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { IAssistantRepository } from '../ports/assistant.repository';
import { AssistantsCrudService } from './assistants-crud.service';
import { ExecuteAssistantDto } from '../dto/execution.dto';
import { Assistant, AssistantStatus } from '@domain/entities/assistant.entity';
import { AgentService } from './agent.service';
import { ExecutionContext } from '@domain/entities/execution-context.entity';
import { ConversationsService } from './conversations.service';
import { Agent } from '@domain/entities/agent.entity';
import { AgentConfig } from '@domain/value-objects/agent-config.vo';
import { AgentCapability } from '@domain/value-objects/agent-capability.vo';
import { IAgentRepository } from '../ports/agent.repository';

@Injectable()
export class AssistantExecutorService {
  constructor(
    private readonly assistantsCrudService: AssistantsCrudService,
    @Inject('IAssistantRepository')
    private readonly assistantsRepository: IAssistantRepository,
    private readonly agentService: AgentService,
    @Inject('IAgentRepository')
    private readonly agentRepository: IAgentRepository,
    @Inject('ILogger')
    private readonly logger: ILogger,
    private readonly conversations: ConversationsService,
  ) {
    this.logger.info('AssistantExecutorService initialized');
  }

  /**
   * Execute an assistant
   */
  async execute(name: string, executeDto: ExecuteAssistantDto): Promise<any> {
    this.logger.info(
      `Executing assistant: ${name} for user: ${executeDto.userId}`,
    );

    try {
      // Validate input
      if (
        !executeDto ||
        typeof executeDto.input !== 'string' ||
        executeDto.input.length === 0
      ) {
        return { success: false, error: 'Invalid or empty input' };
      }

      // Get assistant
      const assistant = await this.assistantsCrudService.findByName(name);

      if (assistant.status !== AssistantStatus.ACTIVE) {
        this.logger.warn(
          `Assistant '${name}' is not active (status: ${assistant.status})`,
        );
        throw new BadRequestException(`Assistant '${name}' is not active`);
      }

      // Convert assistant to agent configuration
      const agent = await this.convertAssistantToAgent(assistant);
      const agentId = agent.id;

      // Ensure conversation
      const convType =
        assistant.agentType === 'react'
          ? 'react'
          : assistant.agentType === 'graph'
            ? 'graph'
            : 'base';
      let conversationId = executeDto.conversationId;
      let conversation = null;
      if (!conversationId) {
        conversation = await this.conversations.createConversation({
          userId: executeDto.userId || 'default-user',
          rootAgentId: agentId,
          type: convType as any,
          initialMessage: {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            content: executeDto.input,
          },
        });
        conversationId = conversation.id;
      } else {
        conversation = await this.conversations.getConversation(conversationId);
        if (!conversation) {
          throw new BadRequestException(`Conversation ${conversationId} not found`);
        }
        // Append user input to existing conversation
        await this.conversations.addMessage(conversationId, {
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: executeDto.input,
        });
      }

      // Check conversation settings for streaming
      const streamingEnabled = this.configService.isStreamingEnabled(
        conversation?.settingsOverrides,
      );

      // Validate model/provider if specified in settings
      if (conversation?.settingsOverrides?.llm) {
        const llmConfig = conversation.settingsOverrides.llm;
        if (llmConfig.provider && llmConfig.model) {
          const validation = await this.modelValidation.validateModel(
            llmConfig.provider,
            llmConfig.model,
          );
          if (!validation.valid) {
            throw new BadRequestException(validation.error);
          }

          // Validate token limits if maxTokens is specified
          if (llmConfig.maxTokens) {
            const tokenValidation = await this.modelValidation.validateTokenLimits(
              llmConfig.provider,
              llmConfig.model,
              llmConfig.maxTokens,
            );
            if (!tokenValidation.valid) {
              throw new BadRequestException(tokenValidation.error);
            }
          }
        }
      }

      // Create execution context with merged settings
      const mergedConfig = this.configService.mergeSettings(agent, conversation?.settingsOverrides);
      const context: Partial<ExecutionContext> = {
        userId: executeDto.userId || 'default-user',
        conversationId,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        config: mergedConfig,
      };

      // Execute using agent service - check if streaming is enabled
      let result;
      if (streamingEnabled || executeDto.options?.streaming) {
        // For streaming, we should use stream method, but executeAgent returns ExecutionResult
        // For now, we'll execute normally but note that streaming should be handled separately
        this.logger.info('Streaming enabled in conversation settings, but using execute method');
        result = await this.agentService.executeAgent(
          agentId,
          executeDto.userId || 'default-user',
          executeDto.input,
          context as ExecutionContext,
        );
      } else {
        result = await this.agentService.executeAgent(
          agentId,
          executeDto.userId || 'default-user',
          executeDto.input,
          context as ExecutionContext,
        );
      }

      // Append assistant response
      await this.conversations.addMessage(conversationId!, {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: String(result.output ?? ''),
      });

      // Update execution stats
      await this.assistantsRepository.updateExecutionStats(name);

      this.logger.info(`Successfully executed assistant: ${name}`);

      return {
        success: true,
        result: result.output,
        assistant: assistant.name,
        type: assistant.agentType,
        streaming: streamingEnabled || executeDto.options?.streaming || false,
        sessionId: conversationId,
        executionTime: result.metadata?.duration || 0,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to execute assistant: ${name}`, {
        error: e.message,
      });
      return { success: false, error: e.message };
    }
  }

  /**
   * Execute assistant with streaming
   */
  async executeStream(
    name: string,
    executeDto: ExecuteAssistantDto,
  ): Promise<AsyncGenerator<string, void, unknown>> {
    this.logger.info(
      `Streaming execution for assistant: ${name}, user: ${executeDto.userId}`,
    );

    try {
      const assistant = await this.assistantsCrudService.findByName(name);

      if (assistant.status !== AssistantStatus.ACTIVE) {
        throw new BadRequestException(`Assistant '${name}' is not active`);
      }

      // Force streaming to be enabled
      const streamingDto = {
        ...executeDto,
        options: {
          ...executeDto.options,
          streaming: true,
        },
      };

      // Streaming execution using agent's stream method
      const context: Partial<ExecutionContext> = {
        userId: executeDto.userId || 'default-user',
        conversationId: executeDto.conversationId || `conv-${Date.now()}`,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Convert assistant to agent
      const agent = await this.convertAssistantToAgent(assistant);
      const agentId = agent.id;

      // Get agent instance for streaming
      const agentInstance = await this.agentService.getAgentInstance(
        agentId,
        executeDto.userId || 'default-user',
      );

      // Use proper streaming execution
      let conversationId = executeDto.conversationId;
      if (!conversationId) {
        const conv = await this.conversations.createConversation({
          userId: executeDto.userId || 'default-user',
          rootAgentId: agentId,
          type:
            assistant.agentType === 'react'
              ? 'react'
              : assistant.agentType === 'graph'
                ? 'graph'
                : ('base' as any),
          initialMessage: {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            content: executeDto.input || '',
          },
        });
        conversationId = conv.id;
      } else {
        await this.conversations.addMessage(conversationId, {
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: executeDto.input || '',
        });
      }

      const streamContext: ExecutionContext = {
        userId: executeDto.userId || 'default-user',
        conversationId: conversationId!,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...context,
      };

      // Stream execution using agent's stream method
      const self = this;
      async function* streamGenerator() {
        let fullOutput = '';
        try {
          for await (const chunk of agentInstance.stream(
            executeDto.input || '',
            streamContext,
          )) {
            fullOutput += chunk;
            yield chunk;
          }

          // Append full response to conversation
          await self.conversations.addMessage(conversationId!, {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: fullOutput,
          });

          // Update execution stats
          await self.assistantsRepository.updateExecutionStats(name);
        } catch (error) {
          self.logger.error(`Streaming error for assistant: ${name}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      return streamGenerator();
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to stream assistant: ${name}`, {
        error: e.message,
      });
      throw error;
    }
  }

  /**
   * Convert Assistant entity to Agent entity
   * Implements proper assistant-to-agent conversion
   */
  private async convertAssistantToAgent(assistant: Assistant): Promise<Agent> {
    // Check if agent already exists by name (assistants have unique names)
    let agent = await this.agentRepository.findByName(assistant.name);
    if (agent) {
      return agent;
    }

    // Extract configuration from assistant
    const intelligenceConfig = assistant.reactConfig?.intelligence ||
      assistant.graphConfig?.nodes?.[0]?.llm || {
        provider: 'openai',
        model: 'gpt-4',
        tokenLimit: 4096,
      };

    // Normalize intelligence config - handle both IntelligenceConfig and plain object
    const llmConfig =
      'llm' in intelligenceConfig ? intelligenceConfig.llm : intelligenceConfig;

    // Create agent config from assistant configuration
    const agentConfig = AgentConfig.create({
      model: llmConfig.model || 'gpt-4',
      provider: llmConfig.provider || 'openai',
      temperature: assistant.reactConfig?.cot?.temperature || 0.7,
      maxTokens: llmConfig.tokenLimit || 4096,
      systemPrompt: this.buildSystemPromptFromAssistant(assistant),
      enableTools: (assistant.tools?.length || 0) > 0,
      toolNames:
        assistant.tools
          ?.filter((t) => t.isEnabled !== false)
          .map((t) => t.toolName) || [],
      streamingEnabled: true,
      timeout: 30000,
    });

    // Map assistant agentType to agent type
    const agentType = this.mapAssistantTypeToAgentType(assistant.agentType);

    // Create capability based on agent type
    let capability: AgentCapability;
    switch (agentType) {
      case 'react':
        capability = AgentCapability.forReAct();
        break;
      case 'graph':
        capability = AgentCapability.forGraph();
        break;
      case 'expert':
        capability = AgentCapability.forExpert();
        break;
      case 'genius':
        capability = AgentCapability.forGenius();
        break;
      case 'collective':
        capability = AgentCapability.forCollective();
        break;
      case 'manager':
        capability = AgentCapability.forManager();
        break;
      default:
        capability = AgentCapability.forReAct();
    }

    // Create agent entity
    agent = Agent.create(assistant.name, agentType, agentConfig, capability);

    // Save to repository
    await this.agentRepository.save(agent);

    this.logger.info('Converted assistant to agent', {
      assistantId: assistant.id,
      assistantName: assistant.name,
      agentId: agent.id,
      agentType,
    });

    return agent;
  }

  /**
   * Map assistant agentType to agent type
   */
  private mapAssistantTypeToAgentType(
    assistantType: string,
  ): 'react' | 'graph' | 'expert' | 'genius' | 'collective' | 'manager' {
    const typeMap: Record<
      string,
      'react' | 'graph' | 'expert' | 'genius' | 'collective' | 'manager'
    > = {
      react: 'react',
      react_agent: 'react',
      graph: 'graph',
      graph_agent: 'graph',
      expert: 'expert',
      genius: 'genius',
      collective: 'collective',
      manager: 'manager',
      custom: 'react', // Default custom to react
    };

    return typeMap[assistantType.toLowerCase()] || 'react';
  }

  /**
   * Build system prompt from assistant configuration
   */
  private buildSystemPromptFromAssistant(assistant: Assistant): string {
    const parts: string[] = [];

    // Add description
    if (assistant.description) {
      parts.push(assistant.description);
    }

    // Add custom prompts
    if (assistant.customPrompts && assistant.customPrompts.length > 0) {
      const activePrompts = assistant.customPrompts
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .map((p) => p.content);
      parts.push(...activePrompts);
    }

    // Add context blocks
    if (assistant.contextBlocks && assistant.contextBlocks.length > 0) {
      const activeBlocks = assistant.contextBlocks
        .filter((b) => b.isActive !== false)
        .map((b) => b.content);
      parts.push(...activeBlocks);
    }

    // Add subject expertise
    if (assistant.subjectExpertise && assistant.subjectExpertise.length > 0) {
      parts.push(`Subject expertise: ${assistant.subjectExpertise.join(', ')}`);
    }

    return (
      parts.join('\n\n') || `You are ${assistant.name}, a helpful AI assistant.`
    );
  }
}
