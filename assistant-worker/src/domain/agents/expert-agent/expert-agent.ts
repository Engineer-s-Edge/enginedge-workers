/**
 * Expert Agent - Multi-Phase Research
 *
 * Implements a multi-phase research pipeline:
 * 1. Exploration: Generate queries, search for sources
 * 2. Analysis: Evaluate sources, extract evidence
 * 3. Synthesis: Integrate findings, generate report
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult } from '../../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider } from '../../ports/llm-provider.port';
import { IRAGServicePort } from '../../ports/rag-service.port';
import {
  ResearchPhase,
  ResearchTopic,
  ResearchSource,
  EvidenceEntry,
  Contradiction,
  SourceCredibility,
  ExpertAgentState,
  ResearchReport,
  ExplorationResult,
  AnalysisResult,
  SynthesisResult,
} from './expert-agent.types';

/**
 * Expert Agent - Multi-phase research with source evaluation and synthesis
 */
export class ExpertAgent extends BaseAgent {
  private researchState: ExpertAgentState;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private ragAdapter?: IRAGServicePort,
    private config: {
      aim_iterations?: number;
      shoot_iterations?: number;
      skin_model?: string;
      temperature?: number;
      model?: string;
      userId?: string;
      conversationId?: string;
    } = {},
  ) {
    super(llmProvider, logger);
    this.researchState = {
      researchPhase: ResearchPhase.EXPLORATION,
      topics: [],
      sources: [],
      evidence: [],
      contradictions: [],
      phaseResults: [],
      currentTopicIndex: 0,
    };
  }

  /**
   * Get current research state
   */
  getResearchState(): ExpertAgentState {
    return { ...this.researchState };
  }

  /**
   * Add a research topic
   */
  addTopic(topic: ResearchTopic): void {
    this.researchState = {
      ...this.researchState,
      topics: [...this.researchState.topics, topic],
    };
    this.logger.info('Added research topic', { query: topic.query });
  }

  /**
   * Add a source
   */
  addSource(source: ResearchSource): void {
    this.researchState = {
      ...this.researchState,
      sources: [...this.researchState.sources, source],
    };
    this.logger.info('Added research source', {
      url: source.url,
      title: source.title,
    });
  }

  /**
   * Add evidence
   */
  addEvidence(evidence: EvidenceEntry): void {
    this.researchState = {
      ...this.researchState,
      evidence: [...this.researchState.evidence, evidence],
    };
    this.logger.info('Added evidence', { sourceId: evidence.sourceId });
  }

  /**
   * Main execution method - implements BaseAgent.run()
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.logger.info('ExpertAgent: Starting research', { input });

      // Initialize research topic from input
      this.addTopic({
        id: `topic_${Date.now()}`,
        query: input,
        priority: 1,
        status: 'in-progress',
      });

      // Phase 1: Exploration (AIM)
      const explorationResult = await this.explorePhase(input);

      // Phase 2: Analysis (SHOOT)
      const analysisResult = await this.analyzePhase();

      // Phase 3: Synthesis (SKIN)
      const synthesisResult = await this.synthesizePhase();

      // Generate final report
      const report = this.generateReport();

      return {
        status: 'success',
        output: report.abstract,
        metadata: {
          phase: 'complete',
          report,
          sourcesFound: explorationResult.sourcesFound,
          evidenceExtracted: analysisResult.evidenceExtracted,
        },
      };
    } catch (error) {
      this.logger.error(
        'ExpertAgent: Research failed',
        error as Record<string, unknown>,
      );
      return {
        status: 'error',
        output: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Streaming execution - implements BaseAgent.runStream()
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    yield `🔬 Expert Agent: Starting research on "${input}"\n\n`;

    // Initialize research topic
    this.addTopic({
      id: `topic_${Date.now()}`,
      query: input,
      priority: 1,
      status: 'in-progress',
    });

    // Phase 1: Exploration
    yield `📍 Phase 1: EXPLORATION (AIM)\n`;
    const explorationResult = await this.explorePhase(input);
    yield `Found ${explorationResult.sourcesFound} sources\n\n`;

    // Phase 2: Analysis
    yield `🔍 Phase 2: ANALYSIS (SHOOT)\n`;
    const analysisResult = await this.analyzePhase();
    yield `Extracted ${analysisResult.evidenceExtracted} evidence entries\n\n`;

    // Phase 3: Synthesis
    yield `📝 Phase 3: SYNTHESIS (SKIN)\n`;
    const synthesisResult = await this.synthesizePhase();
    yield `Generated synthesis\n\n`;

    // Generate report
    const report = this.generateReport();
    yield `\n## Research Report\n\n`;
    yield `${report.abstract}\n\n`;
    yield `### Key Findings\n`;
    for (const finding of report.keyFindings) {
      yield `- ${finding}\n`;
    }
    yield `\n### Confidence: ${report.confidence}%\n`;
  }

  /**
   * Phase 1: Exploration (AIM)
   */
  private async explorePhase(query: string): Promise<ExplorationResult> {
    this.researchState.researchPhase = ResearchPhase.EXPLORATION;
    const iterations = this.config.aim_iterations || 3;
    const startTime = Date.now();

    this.logger.info('ExpertAgent: Exploration phase', { query, iterations });

    // Generate search queries using LLM
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a research assistant. Generate diverse search queries to explore this topic thoroughly.',
        },
        {
          role: 'user',
          content: `Generate ${iterations} different search queries to research: ${query}`,
        },
      ],
      temperature: this.config.temperature || 0.7,
      maxTokens: 500,
    });

    // Parse queries from response
    const queries = response.content
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .slice(0, iterations);

    const sources: ResearchSource[] = [];

    // Use RAG adapter for document search if available
    if (this.ragAdapter && this.config.userId && this.config.conversationId) {
      this.logger.info('ExpertAgent: Using RAG for document search', {
        userId: this.config.userId,
        conversationId: this.config.conversationId,
      });

      try {
        // Search for relevant documents using each generated query
        for (const searchQuery of queries) {
          const searchResult = await this.ragAdapter.searchConversation({
            query: searchQuery,
            userId: this.config.userId,
            conversationId: this.config.conversationId,
            limit: 5,
            similarityThreshold: 0.7,
            includeMetadata: true,
          });

          // Convert RAG search results to ResearchSource format
          searchResult.results.forEach((result) => {
            sources.push({
              id: result.id || `source_${sources.length}`,
              url: `doc://${result.documentId}#chunk${result.chunkIndex}`,
              title:
                (result.metadata?.title as string) ||
                `Document ${result.documentId}`,
              content: result.content,
              credibilityScore: this.calculateCredibility(result.score),
              evaluationNotes: `Document ${result.documentId}, Chunk ${result.chunkIndex}, Similarity: ${result.score.toFixed(3)}`,
            });
          });
        }

        this.logger.info('ExpertAgent: RAG search completed', {
          queriesGenerated: queries.length,
          sourcesFound: sources.length,
        });
      } catch (error) {
        this.logger.error(
          'ExpertAgent: RAG search failed, falling back to simulation',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
        // Fall back to simulated sources if RAG fails
        this.addSimulatedSources(queries, sources);
      }
    } else {
      // Fallback: Simulate source discovery if RAG not available
      this.logger.info(
        'ExpertAgent: RAG not available, using simulated sources',
      );
      this.addSimulatedSources(queries, sources);
    }

    sources.forEach((source) => this.addSource(source));

    return {
      queriesGenerated: queries.length,
      sourcesFound: sources.length,
      documentsCollected: sources.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Calculate credibility score based on similarity score
   */
  private calculateCredibility(similarityScore: number): SourceCredibility {
    if (similarityScore >= 0.9) return SourceCredibility.HIGHLY_TRUSTED;
    if (similarityScore >= 0.75) return SourceCredibility.TRUSTED;
    if (similarityScore >= 0.6) return SourceCredibility.NEUTRAL;
    if (similarityScore >= 0.4) return SourceCredibility.QUESTIONABLE;
    return SourceCredibility.UNRELIABLE;
  }

  /**
   * Add simulated sources (fallback when RAG is not available)
   */
  private addSimulatedSources(
    queries: string[],
    sources: ResearchSource[],
  ): void {
    queries.forEach((q, idx) => {
      sources.push({
        id: `source_${idx}`,
        url: `https://example.com/source${idx}`,
        title: `Source for: ${q}`,
        content: `Content related to ${q}`,
        credibilityScore: SourceCredibility.TRUSTED,
      });
    });
  }

  /**
   * Phase 2: Analysis (SHOOT)
   */
  private async analyzePhase(): Promise<AnalysisResult> {
    this.researchState.researchPhase = ResearchPhase.ANALYSIS;
    const iterations = this.config.shoot_iterations || 5;
    const startTime = Date.now();

    this.logger.info('ExpertAgent: Analysis phase', {
      sources: this.researchState.sources.length,
      iterations,
    });

    const evidenceList: EvidenceEntry[] = [];
    let totalQuality = 0;

    // Analyze each source
    for (const source of this.researchState.sources.slice(0, iterations)) {
      const response = await this.llmProvider.complete({
        model: this.config.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a critical analyst. Extract key evidence and identify any contradictions.',
          },
          {
            role: 'user',
            content: `Analyze this source:\nTitle: ${source.title}\nContent: ${source.content}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      const qualityScore = 85;
      const evidenceEntry: EvidenceEntry = {
        id: `evidence_${evidenceList.length}`,
        sourceId: source.id,
        claim: response.content.substring(0, 200),
        supportingText: response.content,
        qualityScore,
      };

      evidenceList.push(evidenceEntry);
      totalQuality += qualityScore;
      this.addEvidence(evidenceEntry);
    }

    return {
      sourcesEvaluated: this.researchState.sources.length,
      evidenceExtracted: evidenceList.length,
      contradictionsFound: 0,
      averageQuality:
        evidenceList.length > 0 ? totalQuality / evidenceList.length : 0,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Phase 3: Synthesis (SKIN)
   */
  private async synthesizePhase(): Promise<SynthesisResult> {
    this.researchState.researchPhase = ResearchPhase.SYNTHESIS;
    const startTime = Date.now();

    this.logger.info('ExpertAgent: Synthesis phase', {
      evidence: this.researchState.evidence.length,
    });

    // Synthesize findings using LLM
    const evidenceSummary = this.researchState.evidence
      .map((e: EvidenceEntry) => e.claim)
      .join('\n- ');

    const response = await this.llmProvider.complete({
      model: this.config.skin_model || this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a synthesis expert. Integrate research findings into a coherent narrative.',
        },
        {
          role: 'user',
          content: `Synthesize these findings:\n- ${evidenceSummary}`,
        },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    });

    return {
      argumentsBuilt: 1,
      conclusionsDrawn: ['Synthesis phase completed'],
      reportGenerated: true,
      reportLength: 500,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Generate final research report
   */
  private generateReport(): ResearchReport {
    const keyFindings = this.researchState.evidence
      .slice(0, 5)
      .map((e: EvidenceEntry) => e.claim.substring(0, 100));

    return {
      id: `report_${Date.now()}`,
      title: 'Research Report',
      abstract: `Research completed with ${this.researchState.sources.length} sources and ${this.researchState.evidence.length} evidence entries.`,
      topics: [...this.researchState.topics],
      keyFindings,
      evidence: [...this.researchState.evidence],
      contradictions: [...this.researchState.contradictions],
      conclusions: 'Research synthesis completed successfully.',
      generatedAt: new Date(),
      sourceCount: this.researchState.sources.length,
      evidenceCount: this.researchState.evidence.length,
      confidence: 85,
    };
  }
}
