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

@Injectable()
export class AssistantExecutorService {
  constructor(
    private readonly assistantsCrudService: AssistantsCrudService,
    private readonly assistantsRepository: IAssistantRepository,
    private readonly agentService: AgentService,
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

      // For now, create a temporary agent from the assistant configuration
      // TODO: Implement proper assistant-to-agent conversion
      const agentId = `assistant-${assistant.id}`;

      // Ensure conversation
      const convType =
        assistant.agentType === 'react'
          ? 'react'
          : assistant.agentType === 'graph'
            ? 'graph'
            : 'base';
      let conversationId = executeDto.conversationId;
      if (!conversationId) {
        const conv = await this.conversations.createConversation({
          userId: executeDto.userId || 'default-user',
          rootAgentId: agentId,
          type: convType as any,
          initialMessage: {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            content: executeDto.input,
          },
        });
        conversationId = conv.id;
      } else {
        // Append user input to existing conversation
        await this.conversations.addMessage(conversationId, {
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: executeDto.input,
        });
      }

      // Create execution context
      const context: Partial<ExecutionContext> = {
        userId: executeDto.userId || 'default-user',
        conversationId,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Execute using agent service
      // Note: This is a simplified implementation
      // In production, you'd want to properly convert Assistant config to Agent config
      const result = await this.agentService.executeAgent(
        agentId,
        executeDto.userId || 'default-user',
        executeDto.input,
        context as ExecutionContext,
      );

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
        streaming: executeDto.options?.streaming || false,
        sessionId: conversationId,
        executionTime: result.metadata?.duration || 0,
      };
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to execute assistant: ${name}`, e.message);
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

      // TODO: Implement proper streaming execution
      // For now, return a simple async generator
      const agentId = `assistant-${assistant.id}`;
      const context: Partial<ExecutionContext> = {
        userId: executeDto.userId || 'default-user',
        conversationId: executeDto.conversationId || `conv-${Date.now()}`,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This is a placeholder - in production, use proper streaming
      async function* streamGenerator() {
        try {
          const result = await this.agentService.executeAgent(
            agentId,
            executeDto.userId || 'default-user',
            executeDto.input || '',
            context as ExecutionContext,
          );

          // Simulate streaming by chunking the result
          const output = String(result.output || '');
          const chunkSize = 10;
          for (let i = 0; i < output.length; i += chunkSize) {
            yield output.substring(i, i + chunkSize);
          }
        } catch (error) {
          throw error;
        }
      }

      return streamGenerator.call(this);
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to stream assistant: ${name}`, e.message);
      throw error;
    }
  }
}
