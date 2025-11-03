/**
 * ReAct Agent - Reasoning + Acting Pattern
 *
 * Implements the ReAct (Reasoning + Acting) agent:
 * 1. Thought: LLM generates reasoning
 * 2. Action: Decide what action to take (tool or final answer)
 * 3. Observation: Execute action and record result
 * 4. Repeat until final answer
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult, AgentState } from '../../entities';
import { ILogger } from '@application/ports/logger.port';
import { ILLMProvider, LLMRequest } from '@application/ports/llm-provider.port';
import { MemoryManager } from '../../services/memory-manager.service';
import { StateMachine } from '../../services/state-machine.service';
import { ResponseParser } from '../../services/response-parser.service';
import { PromptBuilder } from '../../services/prompt-builder.service';

interface ReActConfig {
  maxIterations?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  [key: string]: any;
}

export interface Thought {
  reasoning: string;
  timestamp: Date;
}

export interface Action {
  type: 'tool' | 'final_answer';
  toolName?: string;
  input?: any;
  answer?: string;
}

export interface Observation {
  result: any;
  timestamp: Date;
}

// Type aliases for backward compatibility
export type ReasoningStep = Thought;
export type ToolInvocation = Action;
export interface ReActResult extends ExecutionResult {
  thoughts: Thought[];
  actions: Action[];
  observations: Observation[];
}

/**
 * ReAct Agent - Reasoning + Acting Pattern
 *
 * Implements the ReAct (Reasoning + Acting) agent:
 * 1. Thought: LLM generates reasoning
 * 2. Action: Decide what action to take (tool or final answer)
 * 3. Observation: Execute action and record result
 * 4. Repeat until final answer
 */
export class ReActAgent extends BaseAgent {
  private config: ReActConfig;
  private thoughts: Thought[] = [];
  private actions: Action[] = [];
  private observations: Observation[] = [];

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private memoryManager: MemoryManager,
    private stateMachine: typeof StateMachine,
    private responseParser: ResponseParser,
    private promptBuilder: PromptBuilder,
    config: ReActConfig,
  ) {
    super(llmProvider, logger);
    this.config = {
      maxIterations: 10,
      temperature: 0.7,
      model: 'gpt-4',
      ...config,
    };
  }

  /**
   * Execute ReAct agent loop
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.addThinkingStep('Starting ReAct agent');
      this.thoughts = [];
      this.actions = [];
      this.observations = [];

      // Build initial prompt
      const systemPrompt =
        this.config.systemPrompt || this.getDefaultSystemPrompt();
      let currentInput = input;
      let iteration = 0;
      const maxIterations = this.config.maxIterations || 10;

      while (iteration < maxIterations && !this.isAborted()) {
        iteration++;
        this.touch();

        this.logger.debug('ReAct iteration', { iteration, maxIterations });

        // Step 1: Generate Thought
        const thought = await this.generateThought(
          currentInput,
          systemPrompt,
          context,
        );
        this.thoughts.push({ reasoning: thought, timestamp: new Date() });
        this.addThinkingStep(`Thought: ${thought}`);

        // Step 2: Parse Action
        const action = await this.parseAction(thought);
        this.actions.push(action);
        this.addThinkingStep(`Action: ${JSON.stringify(action)}`);

        // Check if final answer
        if (action.type === 'final_answer') {
          this.logger.debug('ReAct: Final answer reached');
          return {
            status: 'success',
            output: action.answer || '',
            metadata: {
              iterations: iteration,
              thoughts: this.thoughts,
              actions: this.actions,
              observations: this.observations,
            },
          };
        }

        // Step 3: Execute Tool and Observe
        if (action.type === 'tool' && action.toolName) {
          const observation = await this.executeTool(
            action.toolName,
            action.input || {},
            context,
          );
          this.observations.push(observation);
          this.addThinkingStep(
            `Observation: ${JSON.stringify(observation.result)}`,
          );
          this.recordToolExecution(
            action.toolName,
            action.input,
            observation.result,
          );

          // Add observation to context for next iteration
          currentInput = `Previous thought: ${thought}\n${
            action.toolName
          } result: ${JSON.stringify(observation.result)}`;
        }
      }

      // Max iterations reached
      this.logger.warn('ReAct: Max iterations reached', {
        maxIterations,
        iteration,
      });
      return {
        status: 'error',
        output: `Agent reached maximum iterations (${maxIterations}) without finding final answer`,
        metadata: {
          iterations: iteration,
          thoughts: this.thoughts,
          actions: this.actions,
          observations: this.observations,
        },
      };
    } catch (error) {
      this.logger.error('ReAct execution failed', { error });
      throw error;
    }
  }

  /**
   * Stream-based ReAct execution
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    try {
      yield `ReAct Agent Starting\n`;

      const systemPrompt =
        this.config.systemPrompt || this.getDefaultSystemPrompt();
      let currentInput = input;
      let iteration = 0;
      const maxIterations = this.config.maxIterations || 10;

      while (iteration < maxIterations && !this.isAborted()) {
        iteration++;
        this.touch();

        // Generate Thought
        yield `\n[Iteration ${iteration}/${maxIterations}]\nThinking...\n`;
        const thought = await this.generateThought(
          currentInput,
          systemPrompt,
          context,
        );
        yield `Thought: ${thought}\n`;

        // Parse Action
        const action = await this.parseAction(thought);
        yield `Action: ${JSON.stringify(action)}\n`;

        // Check final answer
        if (action.type === 'final_answer') {
          yield `\nFinal Answer: ${action.answer}\n`;
          break;
        }

        // Execute Tool
        if (action.type === 'tool' && action.toolName) {
          yield `Executing: ${action.toolName}\n`;
          const observation = await this.executeTool(
            action.toolName,
            action.input || {},
            context,
          );
          yield `Observation: ${JSON.stringify(observation.result)}\n`;
          this.recordToolExecution(
            action.toolName,
            action.input,
            observation.result,
          );

          currentInput = `Previous thought: ${thought}\n${
            action.toolName
          } result: ${JSON.stringify(observation.result)}`;
        }
      }

      yield `\nReAct Agent Completed\n`;
    } catch (error) {
      yield `\nError: ${error instanceof Error ? error.message : String(error)}\n`;
      throw error;
    }
  }

  /**
   * Generate thought via LLM
   */
  private async generateThought(
    input: string,
    systemPrompt: string,
    context: ExecutionContext,
  ): Promise<string> {
    try {
      const llmRequest: LLMRequest = {
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        temperature: this.config.temperature || 0.7,
        maxTokens: 500,
      };

      const response = await this.llmProvider.complete(llmRequest);
      return response.content;
    } catch (error) {
      this.logger.error('Failed to generate thought', { error });
      throw error;
    }
  }

  /**
   * Parse LLM response to extract action
   */
  private async parseAction(response: string): Promise<Action> {
    try {
      // Look for Final Answer pattern
      const finalAnswerMatch = response.match(
        /Final\s+Answer\s*:\s*(.+?)(?:\n|$)/i,
      );
      if (finalAnswerMatch) {
        return {
          type: 'final_answer',
          answer: finalAnswerMatch[1].trim(),
        };
      }

      // Look for Action pattern: Action: tool_name
      const actionMatch = response.match(
        /Action\s*:\s*([a-zA-Z_]\w+)\s*(?:\n|$)/,
      );
      if (actionMatch) {
        const toolName = actionMatch[1];

        // Extract Action Input
        const inputMatch = response.match(
          /Action\s+Input\s*:\s*(.+?)(?:\n|$)/is,
        );
        let input = {};

        if (inputMatch) {
          try {
            input = JSON.parse(inputMatch[1]);
          } catch {
            input = { query: inputMatch[1].trim() };
          }
        }

        return {
          type: 'tool',
          toolName,
          input,
        };
      }

      // Default to final answer if no action found
      return {
        type: 'final_answer',
        answer: response,
      };
    } catch (error) {
      this.logger.error('Failed to parse action', { error, response });
      throw error;
    }
  }

  /**
   * Execute tool (mock implementation - real tools would come from agent tool worker)
   */
  private async executeTool(
    toolName: string,
    input: any,
    context: ExecutionContext,
  ): Promise<Observation> {
    try {
      this.logger.debug('Executing tool', { toolName, input });

      // In production, this would call the Agent Tool Worker via Kafka
      // For now, return mock results
      const result = {
        toolName,
        input,
        message: `Tool '${toolName}' executed successfully`,
        timestamp: new Date(),
      };

      return {
        result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Tool execution failed', { error, toolName });
      return {
        result: {
          error: error instanceof Error ? error.message : String(error),
          toolName,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are a helpful AI assistant. Use the following format:

Thought: Describe what you need to do and why
Action: The name of the tool to use, or "Final Answer" if done
Action Input: The input to the tool
Observation: The result from the tool
... (repeat Thought/Action/Observation as needed)

When you have the final answer, use:
Final Answer: Your answer here

Available tools: ${this.config.tools?.join(', ') || 'None'}`;
  }

  /**
   * Get agent state including ReAct-specific info
   */
  override getState(): AgentState {
    return super.getState();
  }

  /**
   * Get ReAct-specific state
   */
  getReActState() {
    return {
      thoughtCount: this.thoughts.length,
      actionCount: this.actions.length,
      observationCount: this.observations.length,
      lastThought: this.thoughts[this.thoughts.length - 1],
      lastAction: this.actions[this.actions.length - 1],
    };
  }
}
