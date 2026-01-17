import { Injectable, Inject, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BatchValidationRequest,
  BatchValidationResult,
  ExpertReport,
  ValidateExpertWorkRequest,
  ValidationAutoFix,
  ValidationCheckSummary,
  ValidationCheckType,
  ValidationConfig,
  ValidationIssue,
  ValidationResult,
  ValidationSeverity,
  ValidationStatistics,
} from '@domain/validation/validation.types';
import { ILogger } from '../ports/logger.port';
import { IEmbedder } from '../ports/embedder.port';
import { KnowledgeGraphService } from './knowledge-graph.service';

type CheckComputationResult = {
  issues: ValidationIssue[];
  score: number;
};

@Injectable()
export class ValidationService {
  private config: ValidationConfig = {
    enabledChecks: [
      ValidationCheckType.HALLUCINATION_DETECTION,
      ValidationCheckType.SOURCE_VERIFICATION,
      ValidationCheckType.FACT_CONSISTENCY,
      ValidationCheckType.LOGICAL_COHERENCE,
      ValidationCheckType.DUPLICATE_DETECTION,
      ValidationCheckType.RELATIONSHIP_VALIDITY,
      ValidationCheckType.CATEGORY_CONSISTENCY,
      ValidationCheckType.COMPLEXITY_MATCH,
      ValidationCheckType.SOURCE_QUALITY,
      ValidationCheckType.COVERAGE_COMPLETENESS,
      ValidationCheckType.CITATION_ACCURACY,
      ValidationCheckType.BIAS_DETECTION,
    ],
    minConfidenceThreshold: 0.6,
    autoFixEnabled: true,
    blockingSeverity: ValidationSeverity.ERROR,
    useValidatorAgents: false,
    timeoutMs: 4 * 60 * 1000,
    coverageTarget: 0.75,
    applyBiasHeuristics: true,
  };

  private readonly history: ValidationResult[] = [];
  private readonly historyLimit = 1000;

  private statistics: ValidationStatistics = {
    totalValidations: 0,
    passRate: 0,
    averageScore: 0,
    autoFixSuccessRate: 0,
    issuesByType: Object.values(ValidationCheckType).reduce(
      (acc, type) => ({ ...acc, [type]: 0 }),
      {} as Record<ValidationCheckType, number>,
    ),
    issuesBySeverity: {
      [ValidationSeverity.INFO]: 0,
      [ValidationSeverity.WARNING]: 0,
      [ValidationSeverity.ERROR]: 0,
      [ValidationSeverity.CRITICAL]: 0,
    },
    averageDurationMs: 0,
    lastUpdated: new Date(),
  };

  private readonly credibleDomains = new Set([
    'edu',
    'gov',
    'org',
    'nature.com',
    'science.org',
    'arxiv.org',
    'ieee.org',
    'acm.org',
    'springer.com',
    'elsevier.com',
    'wiley.com',
    'pubmed.ncbi.nlm.nih.gov',
    'scholar.google.com',
    'researchgate.net',
    'mit.edu',
    'stanford.edu',
    'harvard.edu',
    'berkeley.edu',
  ]);

  private readonly unreliableDomains = new Set([
    'blogspot.com',
    'wordpress.com',
    'medium.com',
    'substack.com',
  ]);

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly knowledgeGraph: KnowledgeGraphService,
    @Optional() @Inject('IEmbedder') private readonly embedder?: IEmbedder,
  ) {}

  getConfig(): ValidationConfig {
    return { ...this.config, enabledChecks: [...this.config.enabledChecks] };
  }

  updateConfig(config: Partial<ValidationConfig>): ValidationConfig {
    this.config = {
      ...this.config,
      ...config,
      enabledChecks: config.enabledChecks
        ? [...config.enabledChecks]
        : this.config.enabledChecks,
    };
    this.logger.info('Validation configuration updated', {
      config: this.config,
    });
    return this.getConfig();
  }

  getStatistics(): ValidationStatistics {
    return {
      ...this.statistics,
      issuesByType: { ...this.statistics.issuesByType },
      issuesBySeverity: { ...this.statistics.issuesBySeverity },
    };
  }

  getHistory(limit = 50): ValidationResult[] {
    return this.history.slice(-limit);
  }

  async validateExpertWork(
    request: ValidateExpertWorkRequest,
  ): Promise<ValidationResult> {
    const startedAt = Date.now();
    const mergedConfig = {
      ...this.config,
      ...(request.config || {}),
      enabledChecks: request.config?.enabledChecks
        ? [...request.config.enabledChecks]
        : this.config.enabledChecks,
    };

    const report = request.expertReport;
    this.logger.info('Starting expert validation', {
      expertId: report.expertId,
      topic: report.topic,
    });

    const checkSummaries: Partial<
      Record<ValidationCheckType, ValidationCheckSummary>
    > = {};
    const issues: ValidationIssue[] = [];

    for (const checkType of mergedConfig.enabledChecks) {
      const { summary, issues: checkIssues } = await this.runCheck(
        checkType,
        report,
        mergedConfig,
      );
      checkSummaries[checkType] = summary;
      issues.push(...checkIssues);
    }

    const filteredIssues = this.filterIssuesByConfidence(
      issues,
      mergedConfig.minConfidenceThreshold,
    );
    const issuesBySeverity = this.countIssuesBySeverity(filteredIssues);
    const status = this.determineStatus(
      filteredIssues,
      mergedConfig.blockingSeverity,
    );
    const requiresManualReview = this.requiresManualReview(
      filteredIssues,
      status,
    );
    const reviewReason = requiresManualReview
      ? this.buildReviewReason(filteredIssues)
      : undefined;

    const autoFixes =
      request.applyFixes && mergedConfig.autoFixEnabled
        ? await this.applyAutoFixes(filteredIssues)
        : undefined;

    const result: ValidationResult = {
      id: randomUUID(),
      expertId: report.expertId,
      reportId: report.reportId,
      topic: report.topic,
      validatedAt: new Date(),
      validationDurationMs: Date.now() - startedAt,
      status,
      score: this.calculateScore(checkSummaries),
      coverageScore: this.calculateCoverageScore(report),
      completenessScore: this.calculateCompletenessScore(report),
      issues: filteredIssues,
      issuesBySeverity,
      checks: checkSummaries,
      requiresManualReview,
      reviewReason,
      autoFixesApplied: autoFixes,
      metadata: request.metadata,
    };

    this.recordHistory(result);
    this.updateStatistics(result, autoFixes);
    return result;
  }

  async validateBatch(
    request: BatchValidationRequest,
  ): Promise<BatchValidationResult> {
    const start = Date.now();
    const results: ValidationResult[] = [];
    const queue = [...request.expertReports];
    const maxConcurrent = Math.max(1, request.maxConcurrent ?? 3);

    while (queue.length > 0) {
      const chunk = queue.splice(0, maxConcurrent);
      const chunkResults = await Promise.all(
        chunk.map((report) =>
          this.validateExpertWork({
            expertReport: report,
            config: request.config,
          }),
        ),
      );
      results.push(...chunkResults);
    }

    const passed = results.filter((r) => r.status !== 'failed').length;
    return {
      total: results.length,
      passed,
      failed: results.length - passed,
      elapsedMs: Date.now() - start,
      results,
    };
  }

  private async runCheck(
    type: ValidationCheckType,
    report: ExpertReport,
    config: ValidationConfig,
  ): Promise<{ summary: ValidationCheckSummary; issues: ValidationIssue[] }> {
    const startedAt = Date.now();
    let computation: CheckComputationResult;

    switch (type) {
      case ValidationCheckType.HALLUCINATION_DETECTION:
        computation = this.detectHallucinations(report);
        break;
      case ValidationCheckType.SOURCE_VERIFICATION:
        computation = await this.verifySources(report);
        break;
      case ValidationCheckType.FACT_CONSISTENCY:
        computation = await this.checkFactConsistency(report);
        break;
      case ValidationCheckType.LOGICAL_COHERENCE:
        computation = this.assessLogicalCoherence(report);
        break;
      case ValidationCheckType.DUPLICATE_DETECTION:
        computation = await this.detectDuplicates(report);
        break;
      case ValidationCheckType.RELATIONSHIP_VALIDITY:
        computation = await this.validateRelationships(report);
        break;
      case ValidationCheckType.CATEGORY_CONSISTENCY:
        computation = this.ensureCategoryConsistency(report);
        break;
      case ValidationCheckType.COMPLEXITY_MATCH:
        computation = this.ensureComplexityMatch(report);
        break;
      case ValidationCheckType.SOURCE_QUALITY:
        computation = await this.evaluateSourceQuality(report);
        break;
      case ValidationCheckType.COVERAGE_COMPLETENESS:
        computation = this.ensureCoverageCompleteness(report, config);
        break;
      case ValidationCheckType.CITATION_ACCURACY:
        computation = this.verifyCitationAccuracy(report);
        break;
      case ValidationCheckType.BIAS_DETECTION:
        computation = this.detectBias(report, config);
        break;
      default:
        computation = { issues: [], score: 1 };
        break;
    }

    const summary: ValidationCheckSummary = {
      type,
      passed: computation.issues.length === 0,
      score: computation.score,
      durationMs: Date.now() - startedAt,
      issueCount: computation.issues.length,
    };

    return { summary, issues: computation.issues };
  }

  private detectHallucinations(report: ExpertReport): CheckComputationResult {
    const suspiciousPatterns = [/tbd/i, /\?\?\?/, /lorem ipsum/i, /undefined/];
    const issues: ValidationIssue[] = [];

    report.findings.forEach((finding, index) => {
      const hasSuspicion = suspiciousPatterns.some((pattern) =>
        pattern.test(finding),
      );
      if (hasSuspicion) {
        issues.push({
          id: `${ValidationCheckType.HALLUCINATION_DETECTION}-${index}-${randomUUID()}`,
          type: ValidationCheckType.HALLUCINATION_DETECTION,
          severity: ValidationSeverity.WARNING,
          confidence: 0.8,
          summary: 'Finding contains placeholder or undefined content',
          details: finding,
          location: `finding:${index}`,
          recommendation: 'Replace placeholders with verified data.',
        });
      }
    });

    if (report.contradictions?.length) {
      issues.push({
        id: `${ValidationCheckType.HALLUCINATION_DETECTION}-contradiction-${randomUUID()}`,
        type: ValidationCheckType.HALLUCINATION_DETECTION,
        severity: ValidationSeverity.ERROR,
        confidence: 0.9,
        summary: 'Reported contradictions detected',
        details: report.contradictions.join('\n'),
        recommendation: 'Resolve contradictions before publishing findings.',
      });
    }

    const score = Math.max(
      0,
      1 - issues.length / Math.max(report.findings.length, 1),
    );

    return { issues, score };
  }

  private async verifySources(
    report: ExpertReport,
  ): Promise<CheckComputationResult> {
    const score = await this.checkSourceCredibility(report.sources);
    const issues: ValidationIssue[] = [];

    if (score < 0.5) {
      issues.push({
        id: `${ValidationCheckType.SOURCE_VERIFICATION}-${randomUUID()}`,
        type: ValidationCheckType.SOURCE_VERIFICATION,
        severity: ValidationSeverity.ERROR,
        confidence: 0.85,
        summary: 'Low proportion of credible sources',
        details: `Credibility score ${score.toFixed(2)} for ${report.sources.length} sources`,
        recommendation: 'Replace weak sources with peer-reviewed references.',
      });
    }

    const missingScheme = report.sources.filter(
      (source) => !/^https?:\/\//i.test(source),
    );
    if (missingScheme.length) {
      issues.push({
        id: `${ValidationCheckType.SOURCE_VERIFICATION}-scheme-${randomUUID()}`,
        type: ValidationCheckType.SOURCE_VERIFICATION,
        severity: ValidationSeverity.WARNING,
        confidence: 0.7,
        summary: 'Sources missing protocol',
        details: `Sources missing http/https: ${missingScheme.join(', ')}`,
        recommendation: 'Ensure sources use fully qualified URLs.',
      });
    }

    return { issues, score };
  }

  private async checkFactConsistency(
    report: ExpertReport,
  ): Promise<CheckComputationResult> {
    const issues: ValidationIssue[] = [];
    const consistent = await this.checkFindingConsistency(report.findings);

    if (!consistent) {
      issues.push({
        id: `${ValidationCheckType.FACT_CONSISTENCY}-${randomUUID()}`,
        type: ValidationCheckType.FACT_CONSISTENCY,
        severity: ValidationSeverity.ERROR,
        confidence: 0.8,
        summary: 'Findings appear inconsistent',
        recommendation:
          'Align conflicting findings or provide clarifying context.',
      });
    }

    if (report.relatedNodes?.length) {
      const nodes = await Promise.all(
        report.relatedNodes.slice(0, 5).map(async (node) => {
          try {
            return await this.knowledgeGraph.getNode(node.nodeId);
          } catch {
            return null;
          }
        }),
      );

      nodes.forEach((node, idx) => {
        if (!node) {
          issues.push({
            id: `${ValidationCheckType.FACT_CONSISTENCY}-missing-node-${idx}-${randomUUID()}`,
            type: ValidationCheckType.FACT_CONSISTENCY,
            severity: ValidationSeverity.WARNING,
            confidence: 0.6,
            summary: 'Referenced knowledge graph node not found',
            details: `Node ID: ${report.relatedNodes?.[idx]?.nodeId}`,
          });
        }
      });
    }

    const score = consistent && issues.length === 0 ? 1 : 0.5;
    return { issues, score };
  }

  private assessLogicalCoherence(report: ExpertReport): CheckComputationResult {
    const issues: ValidationIssue[] = [];
    const summary = report.summary || '';

    if (summary && summary.length < 100) {
      issues.push({
        id: `${ValidationCheckType.LOGICAL_COHERENCE}-${randomUUID()}`,
        type: ValidationCheckType.LOGICAL_COHERENCE,
        severity: ValidationSeverity.INFO,
        confidence: 0.6,
        summary: 'Summary is brief and may omit reasoning steps',
        recommendation: 'Provide a more detailed rationale for conclusions.',
      });
    }

    if (report.findings.length && !summary) {
      issues.push({
        id: `${ValidationCheckType.LOGICAL_COHERENCE}-no-summary-${randomUUID()}`,
        type: ValidationCheckType.LOGICAL_COHERENCE,
        severity: ValidationSeverity.WARNING,
        confidence: 0.7,
        summary: 'Missing summary for provided findings',
        recommendation:
          'Add a synthesis explaining how findings support the topic.',
      });
    }

    const score = Math.max(
      0,
      1 - issues.length / Math.max(report.findings.length, 1),
    );
    return { issues, score };
  }

  private async detectDuplicates(
    report: ExpertReport,
  ): Promise<CheckComputationResult> {
    const duplicated = await this.detectDuplication(report.findings);
    const issues: ValidationIssue[] = [];

    if (duplicated) {
      issues.push({
        id: `${ValidationCheckType.DUPLICATE_DETECTION}-${randomUUID()}`,
        type: ValidationCheckType.DUPLICATE_DETECTION,
        severity: ValidationSeverity.WARNING,
        confidence: 0.75,
        summary: 'Potential duplicate findings detected',
        recommendation: 'Merge overlapping findings to reduce redundancy.',
      });
    }

    return { issues, score: duplicated ? 0.5 : 1 };
  }

  private async validateRelationships(
    report: ExpertReport,
  ): Promise<CheckComputationResult> {
    const issues: ValidationIssue[] = [];

    if (!report.relatedNodes?.length) {
      return { issues, score: 1 };
    }

    for (const reference of report.relatedNodes) {
      if (!reference.relation) {
        issues.push({
          id: `${ValidationCheckType.RELATIONSHIP_VALIDITY}-${reference.nodeId}-${randomUUID()}`,
          type: ValidationCheckType.RELATIONSHIP_VALIDITY,
          severity: ValidationSeverity.INFO,
          confidence: 0.5,
          summary: 'Missing relationship label for referenced node',
          details: `Node ${reference.nodeId}`,
          recommendation:
            'Specify how the finding relates to the referenced node.',
        });
      }
    }

    const score = Math.max(0, 1 - issues.length / report.relatedNodes.length);
    return { issues, score };
  }

  private ensureCategoryConsistency(
    report: ExpertReport,
  ): CheckComputationResult {
    const issues: ValidationIssue[] = [];
    const categories = report.categories || [];

    if (!categories.length) {
      return { issues, score: 1 };
    }

    const categorySet = new Set(categories.map((c) => c.toLowerCase()));
    if (categorySet.size !== categories.length) {
      issues.push({
        id: `${ValidationCheckType.CATEGORY_CONSISTENCY}-${randomUUID()}`,
        type: ValidationCheckType.CATEGORY_CONSISTENCY,
        severity: ValidationSeverity.WARNING,
        confidence: 0.65,
        summary: 'Duplicate categories detected',
        recommendation: 'Normalize category labels to avoid duplication.',
      });
    }

    return { issues, score: issues.length ? 0.6 : 1 };
  }

  private ensureComplexityMatch(report: ExpertReport): CheckComputationResult {
    const issues: ValidationIssue[] = [];
    if (
      report.complexity !== undefined &&
      (report.complexity < 1 || report.complexity > 6)
    ) {
      issues.push({
        id: `${ValidationCheckType.COMPLEXITY_MATCH}-${randomUUID()}`,
        type: ValidationCheckType.COMPLEXITY_MATCH,
        severity: ValidationSeverity.ERROR,
        confidence: 0.8,
        summary: `Complexity value ${report.complexity} outside supported range`,
        recommendation: 'Use L1-L6 complexity scale for resume artifacts.',
      });
    }
    return { issues, score: issues.length ? 0.4 : 1 };
  }

  private async evaluateSourceQuality(
    report: ExpertReport,
  ): Promise<CheckComputationResult> {
    const issues: ValidationIssue[] = [];
    const sources = report.sources || [];
    const domainCounts: Record<string, number> = {};

    sources.forEach((source) => {
      const domain = this.extractDomain(source);
      if (!domain) {
        return;
      }
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      if (this.unreliableDomains.has(domain)) {
        issues.push({
          id: `${ValidationCheckType.SOURCE_QUALITY}-${domain}-${randomUUID()}`,
          type: ValidationCheckType.SOURCE_QUALITY,
          severity: ValidationSeverity.WARNING,
          confidence: 0.7,
          summary: `Source from lower-reputation domain (${domain})`,
          details: source,
          recommendation: 'Cross-check findings with a peer-reviewed source.',
        });
      }
    });

    const dominantDomain = Object.entries(domainCounts).find(
      ([, count]) => count / sources.length > 0.6,
    );
    if (dominantDomain) {
      issues.push({
        id: `${ValidationCheckType.SOURCE_QUALITY}-diversity-${randomUUID()}`,
        type: ValidationCheckType.SOURCE_QUALITY,
        severity: ValidationSeverity.INFO,
        confidence: 0.55,
        summary: 'Limited source diversity detected',
        details: `Domain ${dominantDomain[0]} accounts for over 60% of sources`,
        recommendation: 'Add sources from additional publishers to avoid bias.',
      });
    }

    const score = Math.max(0, 1 - issues.length / Math.max(sources.length, 1));
    return { issues, score };
  }

  private ensureCoverageCompleteness(
    report: ExpertReport,
    config: ValidationConfig,
  ): CheckComputationResult {
    const expected = (report.metadata?.expectedFindings as number) || 4;
    const actual = report.findings.length;
    const coverageRatio = actual / Math.max(expected, 1);
    const issues: ValidationIssue[] = [];

    if (coverageRatio < (config.coverageTarget ?? 0.75)) {
      issues.push({
        id: `${ValidationCheckType.COVERAGE_COMPLETENESS}-${randomUUID()}`,
        type: ValidationCheckType.COVERAGE_COMPLETENESS,
        severity: ValidationSeverity.WARNING,
        confidence: 0.75,
        summary: 'Coverage below expected threshold',
        details: `Expected at least ${expected} findings, received ${actual}`,
        recommendation:
          'Expand research to cover additional aspects of the topic.',
      });
    }

    return { issues, score: Math.min(1, coverageRatio) };
  }

  private verifyCitationAccuracy(report: ExpertReport): CheckComputationResult {
    const issues: ValidationIssue[] = [];
    const citations = report.citations || [];

    citations.forEach((citation, index) => {
      if (
        !report.sources.some((source) =>
          source.includes(citation.sourceId ?? ''),
        )
      ) {
        issues.push({
          id: `${ValidationCheckType.CITATION_ACCURACY}-${index}-${randomUUID()}`,
          type: ValidationCheckType.CITATION_ACCURACY,
          severity: ValidationSeverity.WARNING,
          confidence: 0.65,
          summary: 'Citation references unknown source',
          details: `Citation ${citation.text}`,
          recommendation:
            'Ensure every citation maps to a provided source URL.',
        });
      }
    });

    const score =
      citations.length === 0
        ? 1
        : Math.max(0, 1 - issues.length / citations.length);
    return { issues, score };
  }

  private detectBias(
    report: ExpertReport,
    config: ValidationConfig,
  ): CheckComputationResult {
    if (!config.applyBiasHeuristics) {
      return { issues: [], score: 1 };
    }

    const issues: ValidationIssue[] = [];
    const biasedTerms = [/always/i, /never/i, /guaranteed/i, /perfect/i];

    report.findings.forEach((finding, index) => {
      if (biasedTerms.some((term) => term.test(finding))) {
        issues.push({
          id: `${ValidationCheckType.BIAS_DETECTION}-${index}-${randomUUID()}`,
          type: ValidationCheckType.BIAS_DETECTION,
          severity: ValidationSeverity.INFO,
          confidence: 0.6,
          summary: 'Absolute language detected',
          details: finding,
          recommendation: 'Use quantifiable evidence instead of absolutes.',
        });
      }
    });

    return {
      issues,
      score: Math.max(
        0,
        1 - issues.length / Math.max(report.findings.length, 1),
      ),
    };
  }

  private filterIssuesByConfidence(
    issues: ValidationIssue[],
    minConfidence: number,
  ): ValidationIssue[] {
    return issues.filter((issue) => issue.confidence >= minConfidence);
  }

  private countIssuesBySeverity(
    issues: ValidationIssue[],
  ): Record<ValidationSeverity, number> {
    const counts: Record<ValidationSeverity, number> = {
      [ValidationSeverity.INFO]: 0,
      [ValidationSeverity.WARNING]: 0,
      [ValidationSeverity.ERROR]: 0,
      [ValidationSeverity.CRITICAL]: 0,
    };

    issues.forEach((issue) => {
      counts[issue.severity] += 1;
    });

    return counts;
  }

  private severityRank(severity: ValidationSeverity): number {
    switch (severity) {
      case ValidationSeverity.INFO:
        return 0;
      case ValidationSeverity.WARNING:
        return 1;
      case ValidationSeverity.ERROR:
        return 2;
      case ValidationSeverity.CRITICAL:
        return 3;
      default:
        return 0;
    }
  }

  private determineStatus(
    issues: ValidationIssue[],
    blockingSeverity: ValidationSeverity,
  ): ValidationResult['status'] {
    const blockingRank = this.severityRank(blockingSeverity);
    const maxIssueRank = Math.max(
      0,
      ...issues.map((issue) => this.severityRank(issue.severity)),
    );

    if (maxIssueRank >= blockingRank) {
      return 'failed';
    }
    return issues.length > 0 ? 'passed-with-warnings' : 'passed';
  }

  private requiresManualReview(
    issues: ValidationIssue[],
    status: ValidationResult['status'],
  ): boolean {
    return (
      status === 'failed' ||
      issues.some((issue) => issue.severity === ValidationSeverity.CRITICAL)
    );
  }

  private buildReviewReason(issues: ValidationIssue[]): string | undefined {
    if (!issues.length) {
      return undefined;
    }
    const reasonIssue =
      issues.find((issue) => issue.severity === ValidationSeverity.CRITICAL) ||
      issues[0];
    return `${reasonIssue.type} (${reasonIssue.severity})`;
  }

  private calculateScore(
    summaries: Partial<Record<ValidationCheckType, ValidationCheckSummary>>,
  ): number {
    const values = Object.values(summaries)
      .filter((summary): summary is ValidationCheckSummary => Boolean(summary))
      .map((summary) => summary.score);
    if (!values.length) {
      return 0;
    }
    return values.reduce((sum, score) => sum + score, 0) / values.length;
  }

  private calculateCoverageScore(report: ExpertReport): number {
    const expected = (report.metadata?.expectedFindings as number) || 4;
    return Math.min(1, report.findings.length / Math.max(expected, 1));
  }

  private calculateCompletenessScore(report: ExpertReport): number {
    if (!report.sources.length) {
      return 0.4;
    }
    const metrics = [
      Math.min(1, report.sources.length / Math.max(report.findings.length, 1)),
      report.summary ? 1 : 0.6,
      report.citations?.length ? 1 : 0.7,
    ];
    return metrics.reduce((sum, metric) => sum + metric, 0) / metrics.length;
  }

  private async applyAutoFixes(
    issues: ValidationIssue[],
  ): Promise<ValidationAutoFix[]> {
    const fixes: ValidationAutoFix[] = [];
    for (const issue of issues) {
      if (issue.severity === ValidationSeverity.CRITICAL) {
        continue;
      }
      fixes.push({
        issueId: issue.id,
        action: `flag-${issue.type}`,
        success: true,
        appliedAt: new Date(),
        details: 'Flagged for follow-up in manual review queue.',
      });
    }
    return fixes;
  }

  private recordHistory(result: ValidationResult): void {
    this.history.push(result);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  private updateStatistics(
    result: ValidationResult,
    autoFixes?: ValidationAutoFix[],
  ): void {
    const stats = this.statistics;
    stats.totalValidations += 1;
    const total = stats.totalValidations;

    const previousPassRatio = stats.passRate / 100;
    const passed = result.status === 'failed' ? 0 : 1;
    const newPassRatio = (previousPassRatio * (total - 1) + passed) / total;
    stats.passRate = Number((newPassRatio * 100).toFixed(2));

    stats.averageScore =
      (stats.averageScore * (total - 1) + result.score) / total;

    Object.values(ValidationCheckType).forEach((type) => {
      const summary = result.checks?.[type];
      if (summary && summary.issueCount) {
        stats.issuesByType[type] += summary.issueCount;
      }
    });

    result.issues.forEach((issue) => {
      stats.issuesBySeverity[issue.severity] += 1;
    });

    if (autoFixes?.length) {
      const successful = autoFixes.filter((fix) => fix.success).length;
      const previousRatio = stats.autoFixSuccessRate / 100;
      const batchRatio = successful / autoFixes.length;
      const newRatio = (previousRatio * (total - 1) + batchRatio) / total;
      stats.autoFixSuccessRate = Number((newRatio * 100).toFixed(2));
    }

    stats.averageDurationMs =
      (stats.averageDurationMs * (total - 1) + result.validationDurationMs) /
      total;
    stats.lastUpdated = new Date();
  }

  async checkSourceCredibility(sources: string[]): Promise<number> {
    if (!sources || sources.length === 0) {
      return 0.5;
    }

    let credibleCount = 0;
    let unreliableCount = 0;

    sources.forEach((source) => {
      const domain = this.extractDomain(source);
      if (!domain) {
        return;
      }
      if (this.credibleDomains.has(domain) || domain.endsWith('.edu')) {
        credibleCount++;
      }
      if (this.unreliableDomains.has(domain)) {
        unreliableCount++;
      }
    });

    const credibleRatio = credibleCount / sources.length;
    const unreliableRatio = unreliableCount / sources.length;
    let score = 0.2 + credibleRatio * 0.6 - unreliableRatio * 0.3;
    const diversityBonus = Math.min(0.1, (sources.length - 1) * 0.02);
    score = score + diversityBonus;
    return Math.max(0, Math.min(0.95, score));
  }

  async checkFindingConsistency(findings: string[]): Promise<boolean> {
    if (!findings || findings.length <= 1) {
      return true;
    }

    if (this.embedder && findings.length > 1) {
      try {
        const embeddings = await Promise.all(
          findings.map((f) => this.embedder!.embedText(f)),
        );
        let consistentPairs = 0;
        let totalPairs = 0;
        for (let i = 0; i < embeddings.length - 1; i++) {
          for (let j = i + 1; j < embeddings.length; j++) {
            const similarity = this.cosineSimilarity(
              embeddings[i],
              embeddings[j],
            );
            totalPairs++;
            if (similarity > 0.5) {
              consistentPairs++;
            }
          }
        }
        return totalPairs > 0 && consistentPairs / totalPairs >= 0.5;
      } catch (error) {
        this.logger.warn(
          'Embedding-based consistency check failed, using keyword fallback',
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    return this.checkFindingsConsistencyKeywords(findings);
  }

  async detectDuplication(findings: string[]): Promise<boolean> {
    if (!findings || findings.length < 3) {
      return false;
    }

    if (this.embedder) {
      try {
        const embeddings = await Promise.all(
          findings.map((f) => this.embedder!.embedText(f)),
        );
        for (let i = 0; i < embeddings.length - 1; i++) {
          for (let j = i + 1; j < embeddings.length; j++) {
            const similarity = this.cosineSimilarity(
              embeddings[i],
              embeddings[j],
            );
            if (similarity > 0.9) {
              return true;
            }
          }
        }
        return false;
      } catch (error) {
        this.logger.warn(
          'Embedding-based duplication detection failed, using text fallback',
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    return this.detectDuplicationText(findings);
  }

  async checkSemanticValidity(findings: string[]): Promise<boolean> {
    if (!findings || findings.length === 0) {
      return false;
    }
    const validFindings = findings.filter((f) => {
      const trimmed = f.trim();
      if (trimmed.length < 10) {
        return false;
      }
      if (trimmed.toLowerCase().includes('error')) {
        return false;
      }
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 3) {
        return false;
      }
      return true;
    });

    return validFindings.length / findings.length >= 0.8;
  }

  private extractDomain(source: string): string | null {
    try {
      const url = new URL(
        source.startsWith('http') ? source : `https://${source}`,
      );
      return url.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private checkFindingsConsistencyKeywords(findings: string[]): boolean {
    const keywords = findings.map((f) => {
      const words = f
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return new Set(words);
    });

    let overlapCount = 0;
    let totalPairs = 0;

    for (let i = 0; i < keywords.length - 1; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const intersection = new Set(
          [...keywords[i]].filter((x) => keywords[j].has(x)),
        );
        totalPairs++;
        if (intersection.size > 2) {
          overlapCount++;
        }
      }
    }
    return totalPairs > 0 && overlapCount / totalPairs >= 0.5;
  }

  private detectDuplicationText(findings: string[]): boolean {
    const normalized = findings.map((f) =>
      f.toLowerCase().replace(/\s+/g, ' ').trim(),
    );

    for (let i = 0; i < normalized.length - 1; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (normalized[i] === normalized[j]) {
          return true;
        }
        const longer =
          normalized[i].length > normalized[j].length
            ? normalized[i]
            : normalized[j];
        const shorter =
          normalized[i].length > normalized[j].length
            ? normalized[j]
            : normalized[i];
        if (longer.includes(shorter) && shorter.length / longer.length > 0.9) {
          return true;
        }
      }
    }
    return false;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
