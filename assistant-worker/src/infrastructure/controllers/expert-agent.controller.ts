/**
 * Expert Agent Controller
 *
 * Specialized endpoints for Expert (research) agents.
 * Handles AIM-SHOOT-SKIN research methodology.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import {
  ExpertAgent,
  ExpertAgentState,
  ResearchPhase,
  ResearchSource,
  EvidenceEntry,
  ResearchReport,
  SourceCredibility,
  Contradiction,
} from '@domain/agents/expert-agent';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

type ResearchFormat = 'markdown' | 'html' | 'pdf';

interface SerializedResearchSource {
  id: string;
  title: string;
  url: string;
  author: string | null;
  publishDate: string | null;
  credibility: SourceCredibility | null;
  evaluationNotes: string | null;
  contentPreview: string;
  order: number;
}

interface SourceMetrics {
  total: number;
  averageCredibility: number;
  credibilityDistribution: Record<string, number>;
  topicsExplored: number;
}

interface SerializedEvidence {
  id: string;
  sourceId: string;
  topicId?: string;
  claim: string;
  supportingText: string;
  qualityScore: number;
  contradicts: string[];
  tags: string[];
}

interface EvidenceMetrics {
  total: number;
  averageQuality: number;
  contradictionHints: number;
}

interface SerializedContradiction {
  id: string;
  evidenceId1: string;
  evidenceId2: string;
  description: string;
  severity: Contradiction['severity'];
}

interface ContradictionMetrics {
  total: number;
  bySeverity: Record<string, number>;
}

interface SerializedResearchReport
  extends Omit<ResearchReport, 'generatedAt' | 'evidence' | 'contradictions'> {
  generatedAt: string;
  evidence: SerializedEvidence[];
  contradictions: SerializedContradiction[];
}

/**
 * Expert Agent specialized controller
 */
@Controller('agents/expert')
export class ExpertAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly streamAgentExecutionUseCase: StreamAgentExecutionUseCase,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/expert/create - Create Expert research agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createExpertAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      maxSources?: number;
      researchDepth?: 'shallow' | 'medium' | 'deep';
    },
  ) {
    this.logger.info('Creating Expert agent', { name: body.name });

    const config = {
      maxSources: body.maxSources || 10,
      researchDepth: body.researchDepth || 'medium',
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'expert', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'expert',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/expert/:id/research - Conduct research
   */
  @Post(':id/research')
  @HttpCode(HttpStatus.OK)
  async conductResearch(
    @Param('id') agentId: string,
    @Body()
    body: {
      query: string;
      userId: string;
      phases?: Array<'aim' | 'shoot' | 'skin'>;
    },
  ) {
    this.logger.info('Conducting research', { agentId, query: body.query });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.query,
      context: {
        phases: body.phases || ['aim', 'shoot', 'skin'],
      },
    });

    return result;
  }

  /**
   * GET /agents/expert/:id/sources - Get research sources
   */
  @Get(':id/sources')
  async getResearchSources(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const state = await this.getExpertState(agentId, userId);
    const sources = state.sources.map((source, index) =>
      this.serializeSource(source, index),
    );

    return {
      agentId,
      phase: state.researchPhase,
      total: sources.length,
      metrics: this.buildSourceMetrics(state),
      sources,
    };
  }

  /**
   * GET /agents/expert/:id/evidence - Get extracted evidence
   */
  @Get(':id/evidence')
  async getEvidence(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const state = await this.getExpertState(agentId, userId);
    const evidence = state.evidence.map((entry) => this.serializeEvidence(entry));

    return {
      agentId,
      total: evidence.length,
      metrics: this.buildEvidenceMetrics(state.evidence),
      evidence,
    };
  }

  /**
   * GET /agents/expert/:id/contradictions - Get detected contradictions
   */
  @Get(':id/contradictions')
  async getContradictions(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const state = await this.getExpertState(agentId, userId);
    const contradictions = state.contradictions.map((entry) =>
      this.serializeContradiction(entry),
    );

    return {
      agentId,
      total: contradictions.length,
      metrics: this.buildContradictionMetrics(state.contradictions),
      contradictions,
    };
  }

  /**
   * POST /agents/expert/:id/synthesize - Generate research report
   */
  @Post(':id/synthesize')
  @HttpCode(HttpStatus.OK)
  async synthesizeReport(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      format?: 'markdown' | 'html' | 'pdf';
    },
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required to synthesize report');
    }

    const instance = await this.ensureExpertAgent(agentId, body.userId);
    const report = instance.getResearchReport();

    if (!report) {
      throw new BadRequestException(
        'Research report is not available yet. Execute research before synthesizing.',
      );
    }

    const serialized = this.serializeReport(report);
    const format: ResearchFormat = body.format || 'markdown';

    return {
      agentId,
      format,
      generatedAt: serialized.generatedAt,
      report: serialized,
      rendered: this.renderReport(serialized, format),
    };
  }

  /**
   * GET /agents/expert/research/stream - Stream research progress (SSE)
   * Legacy-compatible endpoint matching /assistants/expert/research/stream
   */
  @Get('research/stream')
  @Sse()
  streamResearch(
    @Query('query') query: string,
    @Query('userId') userId: string,
    @Query('researchDepth') researchDepth?: 'basic' | 'advanced',
    @Query('maxSources') maxSources?: string,
    @Query('maxTokens') maxTokens?: string,
    @Query('useBertScore') useBertScore?: string,
    @Query('conversationId') conversationId?: string,
    @Query('agentId') agentId?: string,
  ): Observable<MessageEvent> {
    if (!query || !userId) {
      throw new BadRequestException('query and userId are required');
    }

    return new Observable<MessageEvent>((subscriber) => {
      let isClosed = false;
      let heartbeat: NodeJS.Timeout | null = null;

      const pushEvent = (event: MessageEvent) => {
        if (!isClosed) {
          subscriber.next(event);
        }
      };

      (async () => {
        try {
          const resolvedAgentId = await this.resolveTargetAgentId(
            agentId,
            userId,
          );

          pushEvent(
            new MessageEvent('research-started', {
              data: {
                agentId: resolvedAgentId,
                query,
                timestamp: new Date().toISOString(),
              },
            }),
          );

          const stream = this.streamAgentExecutionUseCase.execute({
            agentId: resolvedAgentId,
            userId,
            input: query,
            context: {
              conversationId,
              config: {
                researchDepth,
                maxSources: maxSources ? parseInt(maxSources, 10) : undefined,
                maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
                useBertScore: useBertScore === 'true',
              },
              metadata: {
                streamKind: 'expert-research',
              },
            },
          });

          let chunkIndex = 0;
          for await (const chunk of stream) {
            if (isClosed) {
              break;
            }

            const normalized = typeof chunk === 'string' ? chunk : `${chunk}`;
            const phase = this.detectPhaseFromChunk(normalized);

            chunkIndex += 1;
            pushEvent(
              new MessageEvent('research-chunk', {
                data: {
                  agentId: resolvedAgentId,
                  chunk: normalized,
                  chunkIndex,
                  phase,
                  timestamp: new Date().toISOString(),
                },
              }),
            );
          }

          pushEvent(
            new MessageEvent('research-completed', {
              data: {
                agentId: resolvedAgentId,
                timestamp: new Date().toISOString(),
              },
            }),
          );
          subscriber.complete();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Stream error';
          pushEvent(
            new MessageEvent('research-error', {
              data: {
                message,
                timestamp: new Date().toISOString(),
              },
            }),
          );
          subscriber.error(error);
        } finally {
          if (heartbeat) {
            clearInterval(heartbeat);
          }
        }
      })();

      heartbeat = setInterval(() => {
        pushEvent(
          new MessageEvent('heartbeat', {
            data: { timestamp: new Date().toISOString() },
          }),
        );
      }, 30000);

      return () => {
        isClosed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
      };
    });
  }

  private async getExpertState(
    agentId: string,
    userId: string,
  ): Promise<ExpertAgentState> {
    const instance = await this.ensureExpertAgent(agentId, userId);
    return instance.getResearchState();
  }

  private async ensureExpertAgent(
    agentId: string,
    userId: string,
  ): Promise<ExpertAgent> {
    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof ExpertAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not an Expert agent`,
      );
    }

    return instance;
  }

  private serializeSource(
    source: ResearchSource,
    index: number,
  ): SerializedResearchSource {
    return {
      id: source.id,
      title: source.title,
      url: source.url,
      author: source.author ?? null,
      publishDate: source.publishDate
        ? source.publishDate.toISOString()
        : null,
      credibility: source.credibilityScore ?? null,
      evaluationNotes: source.evaluationNotes ?? null,
      contentPreview: this.trimContent(source.content),
      order: index + 1,
    };
  }

  private buildSourceMetrics(state: ExpertAgentState): SourceMetrics {
    if (state.sources.length === 0) {
      return {
        total: 0,
        averageCredibility: 0,
        credibilityDistribution: {},
        topicsExplored: state.topics.length,
      };
    }

    const distribution: Record<string, number> = {
      highlyTrusted: 0,
      trusted: 0,
      neutral: 0,
      questionable: 0,
      unreliable: 0,
      unknown: 0,
    };

    let sum = 0;
    state.sources.forEach((source) => {
      if (source.credibilityScore) {
        sum += source.credibilityScore;
        const bucket = this.mapCredibilityToBucket(source.credibilityScore);
        distribution[bucket] += 1;
      } else {
        distribution.unknown += 1;
      }
    });

    return {
      total: state.sources.length,
      averageCredibility: Number(
        (sum / state.sources.length || 0).toFixed(2),
      ),
      credibilityDistribution: distribution,
      topicsExplored: state.topics.length,
    };
  }

  private mapCredibilityToBucket(score: SourceCredibility): string {
    switch (score) {
      case SourceCredibility.HIGHLY_TRUSTED:
        return 'highlyTrusted';
      case SourceCredibility.TRUSTED:
        return 'trusted';
      case SourceCredibility.NEUTRAL:
        return 'neutral';
      case SourceCredibility.QUESTIONABLE:
        return 'questionable';
      case SourceCredibility.UNRELIABLE:
        return 'unreliable';
      default:
        return 'unknown';
    }
  }

  private buildEvidenceMetrics(
    evidence: readonly EvidenceEntry[],
  ): EvidenceMetrics {
    if (evidence.length === 0) {
      return {
        total: 0,
        averageQuality: 0,
        contradictionHints: 0,
      };
    }

    const qualitySum = evidence.reduce(
      (sum, entry) => sum + entry.qualityScore,
      0,
    );

    const contradictionHints = evidence.filter(
      (entry) => entry.contradicts && entry.contradicts.length > 0,
    ).length;

    return {
      total: evidence.length,
      averageQuality: Number((qualitySum / evidence.length).toFixed(2)),
      contradictionHints,
    };
  }

  private serializeEvidence(entry: EvidenceEntry): SerializedEvidence {
    return {
      id: entry.id,
      sourceId: entry.sourceId,
      topicId: entry.topicId,
      claim: entry.claim,
      supportingText: this.trimContent(entry.supportingText, 600),
      qualityScore: entry.qualityScore,
      contradicts: entry.contradicts ?? [],
      tags: entry.tags ?? [],
    };
  }

  private buildContradictionMetrics(
    contradictions: readonly Contradiction[],
  ): ContradictionMetrics {
    const bySeverity: Record<string, number> = {
      minor: 0,
      moderate: 0,
      major: 0,
    };

    contradictions.forEach((entry) => {
      bySeverity[entry.severity] += 1;
    });

    return {
      total: contradictions.length,
      bySeverity,
    };
  }

  private serializeContradiction(
    contradiction: Contradiction,
  ): SerializedContradiction {
    return {
      id: contradiction.id,
      evidenceId1: contradiction.evidenceId1,
      evidenceId2: contradiction.evidenceId2,
      description: contradiction.description,
      severity: contradiction.severity,
    };
  }

  private serializeReport(report: ResearchReport): SerializedResearchReport {
    return {
      ...report,
      generatedAt: report.generatedAt.toISOString(),
      evidence: report.evidence.map((entry) => this.serializeEvidence(entry)),
      contradictions: report.contradictions.map((entry) =>
        this.serializeContradiction(entry),
      ),
    };
  }

  private renderReport(
    report: SerializedResearchReport,
    format: ResearchFormat,
  ): string | null {
    const markdown = this.buildMarkdownReport(report);

    if (format === 'markdown') {
      return markdown;
    }

    if (format === 'html') {
      return this.convertMarkdownToHtml(markdown);
    }

    return null; // PDF rendering handled by downstream service
  }

  private buildMarkdownReport(report: SerializedResearchReport): string {
    const findings = report.keyFindings
      .map((finding) => `- ${finding}`)
      .join('\n');

    const evidenceSection = report.evidence
      .map((entry) => `- (${entry.qualityScore}/100) ${entry.claim}`)
      .join('\n');

    return `# ${report.title}\n\n${report.abstract}\n\n## Key Findings\n${findings}\n\n## Evidence Highlights\n${evidenceSection}\n\nGenerated at ${report.generatedAt}`;
  }

  private convertMarkdownToHtml(markdown: string): string {
    return markdown
      .split('\n\n')
      .map((block) => {
        if (block.startsWith('# ')) {
          return `<h1>${block.replace('# ', '')}</h1>`;
        }
        if (block.startsWith('## ')) {
          return `<h2>${block.replace('## ', '')}</h2>`;
        }
        if (block.startsWith('- ')) {
          const items = block
            .split('\n')
            .map((item) => `<li>${item.replace('- ', '')}</li>`)
            .join('');
          return `<ul>${items}</ul>`;
        }
        return `<p>${block}</p>`;
      })
      .join('');
  }

  private trimContent(content: string, limit = 320): string {
    if (!content) {
      return '';
    }
    return content.length > limit
      ? `${content.substring(0, limit)}…`
      : content;
  }

  private detectPhaseFromChunk(
    chunk: string,
  ): ResearchPhase | 'lifecycle' {
    const normalized = chunk.toLowerCase();

    if (
      normalized.includes('phase 1') ||
      normalized.includes('exploration') ||
      normalized.includes('aim')
    ) {
      return ResearchPhase.EXPLORATION;
    }

    if (
      normalized.includes('phase 2') ||
      normalized.includes('analysis') ||
      normalized.includes('shoot')
    ) {
      return ResearchPhase.ANALYSIS;
    }

    if (
      normalized.includes('phase 3') ||
      normalized.includes('synthesis') ||
      normalized.includes('skin')
    ) {
      return ResearchPhase.SYNTHESIS;
    }

    if (normalized.includes('[complete]') || normalized.includes('completed')) {
      return ResearchPhase.COMPLETE;
    }

    return 'lifecycle';
  }

  private async resolveTargetAgentId(
    agentId: string | undefined,
    userId: string,
  ): Promise<string> {
    if (agentId) {
      await this.agentService.getAgent(agentId, userId);
      return agentId;
    }

    const existingExperts = await this.agentService.listAgents(userId, {
      type: 'expert',
    });

    if (existingExperts.length > 0) {
      return existingExperts[0].id;
    }

    const fallback = await this.agentService.createAgent(
      {
        name: `Expert-${new Date().toISOString()}`,
        agentType: 'expert',
        config: { researchDepth: 'medium' },
      },
      userId,
    );

    return fallback.id;
  }
}
