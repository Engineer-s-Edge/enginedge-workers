/**
 * Interview Agent
 *
 * Specialized agent for conducting AI-powered mock interviews.
 * Manages interview flow, tracks time, asks questions, and builds candidate profiles.
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult } from '../../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider, LLMRequest } from '../../ports/llm-provider.port';
import {
  InterviewAgentConfig,
  InterviewContext,
} from './interview-agent.types';
import axios from 'axios';

export class InterviewAgent extends BaseAgent {
  private config: InterviewAgentConfig;
  private interviewContext: InterviewContext | null = null;
  private conversationMemory: Array<{
    role: string;
    content: string;
    timestamp: Date;
  }> = [];
  private profileMemory: {
    strengths: string[];
    concerns: string[];
    resumeFindings: any;
    keyInsights: string;
  } = {
    strengths: [],
    concerns: [],
    resumeFindings: {},
    keyInsights: '',
  };

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    config: InterviewAgentConfig,
  ) {
    super(llmProvider, logger);
    this.config = {
      interviewWorkerBaseUrl:
        process.env.INTERVIEW_WORKER_URL || 'http://localhost:3004',
      temperature: 0.7,
      model: 'gpt-4',
      difficulty: 'medium',
      communicationMode: 'text',
      ...config,
    };
  }

  /**
   * Initialize execution context - overrides base implementation
   */
  protected initializeContext(
    input: string,
    context: Partial<ExecutionContext>,
  ): ExecutionContext {
    // Call base implementation first
    const baseContext = super.initializeContext(input, context);

    // Initialize interview context asynchronously (fire and forget)
    this.initializeInterviewContext().catch((error) => {
      this.logger.warn('Failed to initialize interview context', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return baseContext;
  }

  /**
   * Initialize interview context from interview-worker (async helper)
   */
  private async initializeInterviewContext(): Promise<void> {
    try {
      const baseUrl = this.config.interviewWorkerBaseUrl!;

      // Get session details
      const sessionResponse = await axios.get(
        `${baseUrl}/sessions/${this.config.sessionId}`,
      );
      const session = sessionResponse.data;

      // Get interview details
      const interviewResponse = await axios.get(
        `${baseUrl}/interviews/${this.config.interviewId}`,
      );
      const interview = interviewResponse.data;

      // Get current phase info
      const currentPhaseData = interview.phases[session.currentPhase || 0];

      // Calculate questions remaining (simplified - would need actual question tracking)
      const questionsRemainingInPhase = Math.max(
        0,
        (currentPhaseData?.questionCount || 0) -
          (session.currentQuestion ? 1 : 0),
      );
      const totalQuestions = interview.phases.reduce(
        (sum: number, p: any) => sum + p.questionCount,
        0,
      );
      const questionsRemainingTotal = Math.max(
        0,
        totalQuestions - (session.currentQuestion ? 1 : 0),
      );

      this.interviewContext = {
        sessionId: this.config.sessionId,
        interviewId: this.config.interviewId,
        candidateId: this.config.candidateId,
        currentPhase: session.currentPhase || 0,
        currentQuestion: session.currentQuestion,
        timeElapsed: session.timeElapsed || 0,
        phaseTimeElapsed: session.phaseTimeElapsed || 0,
        totalTimeLimit: interview.config.totalTimeLimit,
        phaseTimeLimit: currentPhaseData?.duration || 0,
        questionsRemainingInPhase,
        questionsRemainingTotal,
        communicationMode: session.communicationMode || 'text',
      };

      // Load profile memory
      await this.loadProfileMemory();

      this.logger.debug('Interview context initialized', {
        context: this.interviewContext,
      });
    } catch (error) {
      this.logger.error('Failed to initialize interview context', { error });
      throw error;
    }
  }

  /**
   * Load candidate profile from interview-worker
   */
  private async loadProfileMemory(): Promise<void> {
    try {
      const baseUrl = this.config.interviewWorkerBaseUrl!;
      const profileResponse = await axios.get(
        `${baseUrl}/sessions/${this.config.sessionId}/profile/recall`,
      );
      const profile = profileResponse.data;

      this.profileMemory = {
        strengths: profile.strengths || [],
        concerns: profile.concerns || [],
        resumeFindings: profile.resumeFindings || {},
        keyInsights: profile.keyInsights || '',
      };
    } catch (error) {
      this.logger.warn('Failed to load profile memory, using empty profile', {
        error,
      });
    }
  }

  /**
   * Build system prompt with all interview context
   */
  private buildSystemPrompt(): string {
    if (!this.interviewContext) {
      throw new Error('Interview context not initialized');
    }

    const ctx = this.interviewContext;
    const phaseType = this.getPhaseType(ctx.currentPhase);
    const difficultyPrompt = this.getDifficultyPrompt();

    return `You are an AI interviewer conducting a ${this.config.difficulty} difficulty interview.

${difficultyPrompt}

## Current Interview Status:

**Phase Information:**
- Current Phase: Phase ${ctx.currentPhase + 1} (${phaseType})
- Phase Time: ${Math.floor(ctx.phaseTimeElapsed / 60)}m ${ctx.phaseTimeElapsed % 60}s elapsed / ${ctx.phaseTimeLimit}m limit
- Questions in Phase: ${ctx.questionsRemainingInPhase} remaining

**Overall Interview:**
- Total Time: ${Math.floor(ctx.timeElapsed / 60)}m ${ctx.timeElapsed % 60}s elapsed / ${ctx.totalTimeLimit}m limit
- Total Questions: ${ctx.questionsRemainingTotal} remaining across all phases
- Communication Mode: ${ctx.communicationMode} (${ctx.communicationMode === 'voice' ? 'candidates may use filler words' : 'text-only'})

**Time Management:**
You must manage time carefully. If the candidate is taking too long on a question or phase, you should:
- For current phase: Move on if ${Math.floor(ctx.phaseTimeLimit * 0.9)}m has passed
- For overall interview: Begin wrapping up if ${Math.floor(ctx.totalTimeLimit * 0.9)}m has passed
- Monitor pacing based on questions remaining

**Candidate Profile (so far):**
${this.formatProfileMemory()}

## Available Tools:
1. append_observation(category: "strengths" | "concerns" | "keyInsights", text: string)
   - Record observations about the candidate's performance

2. recall_profile()
   - Get the current candidate profile summary

3. get_followup_count(questionId: string)
   - Check how many follow-ups have been asked for a question

4. check_followup_limit(questionId: string)
   - Check if more follow-ups are allowed for a question

## Instructions:
- Ask questions naturally and conversationally
- After each response, assess and optionally use append_observation if you notice strengths, concerns, or key insights
- Use follow-ups judiciously - typically 1-3 per question, but use recall_profile to see what's been covered
- Keep track of time and questions remaining - adjust pacing accordingly
- Be aware that in voice mode, candidates may use filler words (um, uh, like) - these should be noted in observations
- Wait for the candidate's response before proceeding
- If the interview time is running out or you've asked the target number of questions, begin wrapping up

Current question: ${ctx.currentQuestion || 'None - ready for next question'}`;
  }

  /**
   * Get difficulty-based prompt snippet
   */
  private getDifficultyPrompt(): string {
    switch (this.config.difficulty) {
      case 'easy':
        return `You are a friendly and supportive interviewer. Your goal is to make the candidate feel comfortable and confident. Ask questions clearly and provide gentle encouragement.`;
      case 'hard':
        return `You are a senior interviewer. Your goal is to challenge the candidate and probe the depths of their knowledge. Ask complex questions and expect detailed, well-reasoned answers.`;
      case 'medium':
      default:
        return `You are a professional interviewer. Your goal is to assess the candidate's skills and experience in a fair and balanced way. Ask questions clearly and follow up with relevant probes.`;
    }
  }

  /**
   * Get phase type for current phase
   */
  private getPhaseType(phaseIndex: number): string {
    // This would need to fetch from interview-worker, simplified for now
    return 'technical'; // Default
  }

  /**
   * Format profile memory for prompt
   */
  private formatProfileMemory(): string {
    const parts: string[] = [];

    if (this.profileMemory.strengths.length > 0) {
      parts.push(
        `Strengths:\n${this.profileMemory.strengths.map((s) => `- ${s}`).join('\n')}`,
      );
    }

    if (this.profileMemory.concerns.length > 0) {
      parts.push(
        `Concerns:\n${this.profileMemory.concerns.map((c) => `- ${c}`).join('\n')}`,
      );
    }

    if (this.profileMemory.keyInsights) {
      parts.push(`Key Insights: ${this.profileMemory.keyInsights}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : 'No observations yet.';
  }

  /**
   * Main execution
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      // Initialize context (will also initialize interview context asynchronously)
      this.initializeContext(input, context);

      // Add to conversation memory
      this.conversationMemory.push({
        role: 'candidate',
        content: input,
        timestamp: new Date(),
      });

      // Build prompt
      const systemPrompt = this.buildSystemPrompt();

      // Build messages from conversation history
      const messages: LLMRequest['messages'] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationMemory.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: input },
      ];

      // Define tools
      const tools = this.buildToolsDefinition();

      // Call LLM
      const llmRequest: LLMRequest = {
        model: this.config.model!,
        messages,
        temperature: this.config.temperature,
        tools,
      };

      const response = await this.llmProvider.complete(llmRequest);

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await Promise.all(
          response.toolCalls.map((tc: any) =>
            this.executeTool(
              tc.function.name,
              JSON.parse(tc.function.arguments || '{}'),
            ),
          ),
        );

        // Add tool results to conversation
        this.conversationMemory.push({
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        });

        // Return with tool execution metadata
        return {
          status: 'success',
          output: response.content,
          metadata: {
            toolCalls: response.toolCalls,
            toolResults,
          },
        };
      }

      // Regular response
      this.conversationMemory.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      });

      return {
        status: 'success',
        output: response.content,
      };
    } catch (error) {
      this.logger.error('Interview agent execution failed', { error });
      return {
        status: 'error',
        output: null,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Stream execution
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    try {
      // Initialize context (will also initialize interview context asynchronously)
      this.initializeContext(input, context);

      this.conversationMemory.push({
        role: 'candidate',
        content: input,
        timestamp: new Date(),
      });

      const systemPrompt = this.buildSystemPrompt();
      const messages: LLMRequest['messages'] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationMemory.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: input },
      ];

      const tools = this.buildToolsDefinition();

      const llmRequest: LLMRequest = {
        model: this.config.model!,
        messages,
        temperature: this.config.temperature,
        tools,
      };

      // Get response and stream it in chunks
      const response = await this.llmProvider.complete(llmRequest);

      // Stream response in chunks
      const chunkSize = 50;
      for (let i = 0; i < response.content.length; i += chunkSize) {
        yield response.content.substring(i, i + chunkSize);
      }

      // Update conversation memory with full response
      this.conversationMemory.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      });
    } catch (error) {
      yield `Error: ${error instanceof Error ? error.message : String(error)}\n`;
      throw error;
    }
  }

  /**
   * Build tools definition for LLM
   */
  private buildToolsDefinition(): LLMRequest['tools'] {
    return [
      {
        type: 'function',
        function: {
          name: 'append_observation',
          description:
            'Record an observation about the candidate (strength, concern, or key insight)',
          parameters: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['strengths', 'concerns', 'keyInsights'],
                description: 'Category of observation',
              },
              text: {
                type: 'string',
                description: 'The observation text',
              },
            },
            required: ['category', 'text'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'recall_profile',
          description:
            'Get the current candidate profile summary including strengths, concerns, and insights',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_followup_count',
          description:
            'Get the number of follow-up questions asked for a specific question',
          parameters: {
            type: 'object',
            properties: {
              questionId: {
                type: 'string',
                description: 'The question ID to check',
              },
            },
            required: ['questionId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'check_followup_limit',
          description:
            'Check if more follow-up questions are allowed for a question',
          parameters: {
            type: 'object',
            properties: {
              questionId: {
                type: 'string',
                description: 'The question ID to check',
              },
            },
            required: ['questionId'],
          },
        },
      },
    ];
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolName: string, input: any): Promise<any> {
    const baseUrl = this.config.interviewWorkerBaseUrl!;
    const sessionId = this.config.sessionId;

    try {
      switch (toolName) {
        case 'append_observation':
          await axios.post(
            `${baseUrl}/sessions/${sessionId}/profile/observation`,
            { category: input.category, text: input.text },
          );
          return { success: true, message: 'Observation recorded' };

        case 'recall_profile':
          const profileResponse = await axios.get(
            `${baseUrl}/sessions/${sessionId}/profile/recall`,
          );
          return profileResponse.data;

        case 'get_followup_count':
          // Would need to fetch from interview-worker's response repository
          // Simplified for now
          return { count: 0 };

        case 'check_followup_limit':
          // Would need to check interview config
          return { allowed: true, maxFollowups: 3 };

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.logger.error('Tool execution failed', { toolName, input, error });
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
