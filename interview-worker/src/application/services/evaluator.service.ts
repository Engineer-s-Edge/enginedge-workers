/**
 * Evaluator Service
 *
 * Evaluates completed interviews using LLM through assistant-worker.
 * Calls assistant-worker's LLM endpoint for compartmentalization.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  InterviewSession,
  CandidateProfile,
  Transcript,
  InterviewReport,
  InterviewScore,
} from '../../domain/entities';
import {
  IInterviewSessionRepository,
  ICandidateProfileRepository,
  ITranscriptRepository,
  IInterviewReportRepository,
  IInterviewRepository,
} from '../ports/repositories.port';
import { v4 as uuidv4 } from 'uuid';
import { WebhookService } from './webhook.service';
import { NotificationService } from './notification.service';
import { WebhookEvent } from '../../domain/value-objects/webhook-event.value-object';

@Injectable()
export class EvaluatorService {
  private readonly assistantWorkerUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('ICandidateProfileRepository')
    private readonly profileRepository: ICandidateProfileRepository,
    @Inject('ITranscriptRepository')
    private readonly transcriptRepository: ITranscriptRepository,
    @Inject('IInterviewReportRepository')
    private readonly reportRepository: IInterviewReportRepository,
    @Inject('IInterviewRepository')
    private readonly interviewRepository: IInterviewRepository,
    @Inject(WebhookService)
    private readonly webhookService: WebhookService,
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {
    this.assistantWorkerUrl =
      this.configService.get<string>('ASSISTANT_WORKER_URL') ||
      'http://localhost:3001';
  }

  /**
   * Generate interview report using LLM evaluator
   */
  async generateReport(sessionId: string): Promise<InterviewReport> {
    // Load session data
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'completed') {
      throw new Error(
        `Session must be completed to generate report. Current status: ${session.status}`,
      );
    }

    // Check if report already exists
    const existingReport =
      await this.reportRepository.findBySessionId(sessionId);
    if (existingReport) {
      return existingReport;
    }

    // Load interview configuration
    const interview = await this.interviewRepository.findById(
      session.interviewId,
    );
    if (!interview) {
      throw new Error(`Interview not found: ${session.interviewId}`);
    }

    // Load profile
    const profile = await this.profileRepository.findBySessionId(sessionId);
    if (!profile) {
      throw new Error(`Profile not found for session: ${sessionId}`);
    }

    // Load transcript
    const transcript =
      await this.transcriptRepository.findBySessionId(sessionId);
    if (!transcript) {
      throw new Error(`Transcript not found for session: ${sessionId}`);
    }

    // Build evaluator prompt
    const evaluatorPrompt = this.buildEvaluatorPrompt(
      transcript,
      profile,
      interview,
      session,
    );

    // Perform LLM evaluation
    const llmEvaluation = await this.callLLMEvaluator(evaluatorPrompt);

    // Parse response
    const { score, feedback } = this.parseEvaluationResponse(llmEvaluation);

    // Create report
    const report = new InterviewReport({
      reportId: uuidv4(),
      sessionId,
      score: score,
      feedback: feedback,
      observations: profile.observations,
      transcript,
      generatedAt: new Date(),
    });

    // Save report
    await this.reportRepository.save(report);

    // Trigger webhook
    await this.webhookService.triggerWebhook(WebhookEvent.REPORT_GENERATED, {
      sessionId,
      reportId: report.reportId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      score: report.score,
      generatedAt: report.generatedAt,
    });
    // Optional: send a notification (recipient resolution handled by service integration)
    await this.notificationService.sendEmailNotification(
      session.candidateId,
      'Interview Report Generated',
      `Your interview report for session ${sessionId} has been generated.`,
    );

    return report;
  }

  /**
   * Retrieve previously generated report by session
   */
  async getReport(sessionId: string): Promise<InterviewReport | null> {
    return this.reportRepository.findBySessionId(sessionId);
  }

  /**
   * Build evaluator prompt from interview data
   */
  private buildEvaluatorPrompt(
    transcript: Transcript,
    profile: CandidateProfile,
    interview: any,
    session: InterviewSession,
  ): string {
    const transcriptText = transcript.messages
      .map(
        (msg) =>
          `[${msg.timestamp.toISOString()}] ${msg.speaker.toUpperCase()}: ${msg.text}`,
      )
      .join('\n');

    const profileText =
      `Strengths: ${profile.observations.strengths.join(', ')}\n` +
      `Concerns: ${profile.observations.concerns.join(', ')}\n` +
      `Key Insights: ${profile.observations.keyInsights}\n` +
      `Resume Findings - Verified: ${profile.observations.resumeFindings.verified.join(', ')}\n` +
      `Resume Findings - Questioned: ${profile.observations.resumeFindings.questioned.join(', ')}\n` +
      `Resume Findings - Deep Dived: ${profile.observations.resumeFindings.deepDived.join(', ')}\n` +
      `Communication Style: ${profile.observations.communicationStyle}\n` +
      `Adaptability: ${profile.observations.adaptability}\n` +
      `Skipped Questions: ${profile.observations.interviewFlow.skippedQuestions}\n` +
      `Pause Duration: ${profile.observations.interviewFlow.pauseDuration}s`;

    const configText =
      `Interview Type: ${interview.title}\n` +
      `Phases: ${interview.phases.map((p: any) => `${p.type} (${p.difficulty})`).join(', ')}\n` +
      `Time Elapsed: ${Math.floor(session.timeElapsed / 60)}m ${session.timeElapsed % 60}s\n` +
      `Time Limit: ${interview.config.totalTimeLimit}m\n` +
      `Communication Mode: ${session.communicationMode}`;

    return `You are an expert interview evaluator.

INTERVIEW TRANSCRIPT:
${transcriptText}

CANDIDATE PROFILE (Built during interview):
${profileText}

INTERVIEW CONFIGURATION:
${configText}

TASK:
1. Evaluate overall performance (0-100)
2. Score each phase (0-100) - only score phases that were completed
3. Provide specific, actionable feedback
4. Identify top 3-5 strengths and top 3-5 areas to improve
5. Consider filler words if communication mode was voice

Output valid JSON only (no markdown, no code blocks):
{
  "overall": 0-100,
  "byPhase": {
    "behavioral": 0-100 or null,
    "technical": 0-100 or null,
    "coding": 0-100 or null,
    "systemDesign": 0-100 or null
  },
  "feedback": "Detailed feedback string (2-3 paragraphs)",
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...]
}`;
  }

  /**
   * Call LLM evaluator via assistant-worker
   */
  private async callLLMEvaluator(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.assistantWorkerUrl}/llm/complete`,
        {
          model: 'gpt-4', // Can be configured
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent evaluation
          maxTokens: 2000,
        },
      );

      return (
        response.data.content ||
        response.data.output ||
        JSON.stringify(response.data)
      );
    } catch (error) {
      throw new Error(
        `Failed to call LLM evaluator: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse LLM evaluation response
   */
  private parseEvaluationResponse(llmResponse: string): {
    score: InterviewScore;
    feedback: string;
  } {
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = llmResponse.trim();

      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(jsonStr);

      const score: InterviewScore = {
        overall: this.validateScore(parsed.overall),
        byPhase: {
          behavioral: parsed.byPhase?.behavioral
            ? this.validateScore(parsed.byPhase.behavioral)
            : undefined,
          technical: parsed.byPhase?.technical
            ? this.validateScore(parsed.byPhase.technical)
            : undefined,
          coding: parsed.byPhase?.coding
            ? this.validateScore(parsed.byPhase.coding)
            : undefined,
          systemDesign: parsed.byPhase?.systemDesign
            ? this.validateScore(parsed.byPhase.systemDesign)
            : undefined,
        },
      };

      return {
        score,
        feedback: parsed.feedback || 'No feedback provided.',
      };
    } catch (error) {
      // Fallback parsing if JSON extraction fails
      this.logger.warn('Failed to parse LLM response as JSON, using fallback', {
        error,
        response: llmResponse,
      });

      // Extract scores using regex as fallback
      const overallMatch = llmResponse.match(/overall.*?(\d+)/i);
      const overall = overallMatch ? parseInt(overallMatch[1], 10) : 50;

      return {
        score: {
          overall: this.validateScore(overall),
          byPhase: {},
        },
        feedback: llmResponse.substring(0, 500), // Use first 500 chars as feedback
      };
    }
  }

  /**
   * Validate score is between 0-100
   */
  private validateScore(score: number): number {
    if (typeof score !== 'number') return 50;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get detailed question analysis
   */
  async getQuestionAnalysis(
    sessionId: string,
    questionId: string,
  ): Promise<{
    questionId: string;
    thoughtProcess?: string;
    communicationAnalysis?: string;
    timeSpent?: number;
    scoreBreakdown?: any;
  }> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const transcript =
      await this.transcriptRepository.findBySessionId(sessionId);
    if (!transcript) {
      throw new Error(`Transcript not found for session: ${sessionId}`);
    }

    // Extract messages related to this question
    const questionMessages = transcript.messages.filter((msg) =>
      msg.text.toLowerCase().includes(questionId.toLowerCase()),
    );

    // Calculate time spent (simplified - would need more sophisticated tracking)
    const timeSpent = questionMessages.length > 0
      ? questionMessages[questionMessages.length - 1].timestamp.getTime() -
        questionMessages[0].timestamp.getTime()
      : undefined;

    // Extract thought process indicators
    const thoughtProcess = this.extractThoughtProcess(questionMessages);

    // Communication analysis
    const communicationAnalysis = this.analyzeCommunication(questionMessages);

    return {
      questionId,
      thoughtProcess,
      communicationAnalysis,
      timeSpent: timeSpent ? Math.floor(timeSpent / 1000) : undefined,
      scoreBreakdown: undefined, // Would need to extract from report
    };
  }

  private extractThoughtProcess(messages: any[]): string {
    const candidateMessages = messages.filter((m) => m.speaker === 'candidate');
    const indicators: string[] = [];

    candidateMessages.forEach((msg) => {
      const text = msg.text.toLowerCase();
      if (text.includes('clarify') || text.includes('question')) {
        indicators.push('Asked clarifying questions');
      }
      if (text.includes('hint') || text.includes('help')) {
        indicators.push('Requested hints');
      }
      if (text.includes('think') || text.includes('approach')) {
        indicators.push('Explained approach');
      }
    });

    return indicators.length > 0
      ? indicators.join('. ')
      : 'No clear thought process indicators found';
  }

  private analyzeCommunication(messages: any[]): string {
    const candidateMessages = messages.filter((m) => m.speaker === 'candidate');
    const avgLength =
      candidateMessages.reduce((sum, m) => sum + m.text.length, 0) /
      candidateMessages.length;

    if (avgLength < 50) {
      return 'Brief responses';
    } else if (avgLength > 200) {
      return 'Detailed explanations';
    }
    return 'Balanced communication';
  }

  private get logger() {
    // Simple logger for now - would inject ILogger in production
    return {
      warn: (msg: string, data?: any) => console.warn(msg, data),
      error: (msg: string, data?: any) => console.error(msg, data),
      info: (msg: string, data?: any) => console.info(msg, data),
    };
  }
}
