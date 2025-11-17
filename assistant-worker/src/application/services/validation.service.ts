/**
 * Validation Service
 *
 * Performs comprehensive validation of research data using multiple checks:
 * - Source credibility assessment
 * - Finding consistency analysis
 * - Confidence level validation
 * - Relevance score calculation
 * - Duplication detection
 * - Semantic validity checks
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { IEmbedder } from '../ports/embedder.port';
import {
  ValidationConfig,
  ValidationResult,
} from '../../infrastructure/adapters/interfaces/validation.adapter.interface';

@Injectable()
export class ValidationService {
  // Known credible domains database
  private readonly credibleDomains = new Set([
    'edu', 'gov', 'org', 'nature.com', 'science.org', 'arxiv.org',
    'ieee.org', 'acm.org', 'springer.com', 'elsevier.com', 'wiley.com',
    'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'researchgate.net',
    'mit.edu', 'stanford.edu', 'harvard.edu', 'berkeley.edu',
  ]);

  // Known unreliable domains (would be expanded in production)
  private readonly unreliableDomains = new Set([
    'blogspot.com', 'wordpress.com', // Generic blogs (context-dependent)
  ]);

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    @Optional() @Inject('IEmbedder') private readonly embedder?: IEmbedder,
  ) {}

  /**
   * Validate research data against 6-check pipeline
   */
  async validate(config: ValidationConfig): Promise<ValidationResult> {
    this.logger.info(`Validating research for topic: ${config.topic}`);

    const sources = config.sources || [];
    const findings = config.findings || [];
    const confidence = config.confidence || 0.5;

    // Perform all validation checks
    const sourceCredibilityScore = await this.checkSourceCredibility(sources);
    const sourceCredibility = sourceCredibilityScore >= 0.6;
    const findingConsistency = await this.checkFindingConsistency(findings);
    const confidenceLevel = confidence >= 0.5;
    const relevanceScoreValue = await this.calculateRelevanceScore(config.topic, findings);
    const relevanceScore = relevanceScoreValue >= 0.6;
    const duplicationDetected = await this.detectDuplication(findings);
    const semanticValidity = await this.checkSemanticValidity(findings);

    // Calculate overall score
    const checks = {
      sourceCredibility,
      findingConsistency,
      confidenceLevel,
      relevanceScore,
      duplicationDetected,
      semanticValidity,
    };

    const checkScores = [
      sourceCredibilityScore,
      findingConsistency ? 0.9 : 0.5,
      confidenceLevel ? confidence : 0.3,
      relevanceScoreValue,
      duplicationDetected ? 0.3 : 0.9,
      semanticValidity ? 0.9 : 0.5,
    ];

    const overallScore = checkScores.reduce((a, b) => a + b, 0) / checkScores.length;
    const isValid = overallScore >= 0.6 && Object.values(checks).filter(Boolean).length >= 4;

    // Generate detailed feedback
    const feedback = this.generateFeedback(checks, overallScore, sources.length, findings.length);

    return {
      isValid,
      score: overallScore,
      checks,
      feedback,
    };
  }

  /**
   * Batch validate multiple reports
   */
  async validateBatch(configs: ValidationConfig[]): Promise<ValidationResult[]> {
    this.logger.info(`Validating batch of ${configs.length} reports`);

    // Validate in parallel for efficiency
    const results = await Promise.all(
      configs.map((config) => this.validate(config)),
    );

    const passedCount = results.filter((r) => r.isValid).length;
    this.logger.info(`Batch validation complete: ${passedCount}/${results.length} passed`);

    return results;
  }

  /**
   * Check source credibility based on domain reputation
   */
  async checkSourceCredibility(sources: string[]): Promise<number> {
    if (!sources || sources.length === 0) {
      return 0.5; // Neutral score for no sources
    }

    let credibleCount = 0;
    let unreliableCount = 0;

    sources.forEach((source) => {
      const url = source.toLowerCase();

      // Check for credible domains
      if (Array.from(this.credibleDomains).some((domain) => url.includes(domain))) {
        credibleCount++;
      }

      // Check for unreliable domains
      if (Array.from(this.unreliableDomains).some((domain) => url.includes(domain))) {
        unreliableCount++;
      }
    });

    // Calculate base score from credible sources
    const credibleRatio = credibleCount / sources.length;
    const unreliableRatio = unreliableCount / sources.length;

    // Base score: 0.2 (neutral) + 0.6 (credible bonus) - 0.3 (unreliable penalty)
    let baseScore = 0.2 + (credibleRatio * 0.6) - (unreliableRatio * 0.3);

    // Diversity bonus: more sources = better (up to 0.1 bonus)
    const diversityBonus = Math.min(0.1, (sources.length - 1) * 0.02);
    baseScore += diversityBonus;

    // Ensure score is between 0 and 0.95
    return Math.max(0, Math.min(0.95, baseScore));
  }

  /**
   * Check if findings are consistent with each other
   */
  async checkFindingConsistency(findings: string[]): Promise<boolean> {
    if (!findings || findings.length <= 1) {
      return true; // Single or no findings are trivially consistent
    }

    // Use embeddings if available for semantic similarity
    if (this.embedder && findings.length > 1) {
      try {
        const embeddings = await Promise.all(
          findings.map((f) => this.embedder!.embedText(f)),
        );

        // Calculate pairwise cosine similarity
        let consistentPairs = 0;
        let totalPairs = 0;

        for (let i = 0; i < embeddings.length - 1; i++) {
          for (let j = i + 1; j < embeddings.length; j++) {
            const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
            totalPairs++;
            if (similarity > 0.5) {
              // Similarity threshold for consistency
              consistentPairs++;
            }
          }
        }

        // At least 50% of pairs should be similar for consistency
        return totalPairs > 0 && consistentPairs / totalPairs >= 0.5;
      } catch (error) {
        this.logger.warn('Embedding-based consistency check failed, falling back to keyword method', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to keyword-based method
      }
    }

    // Fallback: Keyword overlap method
    return this.checkFindingsConsistencyKeywords(findings);
  }

  /**
   * Keyword-based consistency check (fallback method)
   */
  private checkFindingsConsistencyKeywords(findings: string[]): boolean {
    const keywords = findings.map((f) => {
      const words = f.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
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
          // At least 3 common keywords suggests consistency
          overlapCount++;
        }
      }
    }

    return totalPairs > 0 && overlapCount / totalPairs >= 0.5;
  }

  /**
   * Calculate relevance score based on topic-finding alignment
   */
  async calculateRelevanceScore(topic: string, findings: string[]): Promise<number> {
    if (!findings || findings.length === 0) {
      return 0.5; // Neutral score for no findings
    }

    // Use embeddings if available for semantic relevance
    if (this.embedder) {
      try {
        const topicEmbedding = await this.embedder.embedText(topic);
        const findingEmbeddings = await Promise.all(
          findings.map((f) => this.embedder!.embedText(f)),
        );

        // Calculate similarity between topic and each finding
        const similarities = findingEmbeddings.map((fe) =>
          this.cosineSimilarity(topicEmbedding, fe),
        );

        // Average similarity score
        const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
        return Math.min(0.95, 0.5 + avgSimilarity * 0.45);
      } catch (error) {
        this.logger.warn('Embedding-based relevance check failed, falling back to keyword method', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to keyword-based method
      }
    }

    // Fallback: Keyword overlap method
    return this.calculateRelevanceScoreKeywords(topic, findings);
  }

  /**
   * Keyword-based relevance calculation (fallback method)
   */
  private calculateRelevanceScoreKeywords(topic: string, findings: string[]): number {
    const topicWords = new Set(
      topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    );

    let relevantCount = 0;
    findings.forEach((finding) => {
      const findingWords = finding.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const overlap = findingWords.filter((w) => topicWords.has(w)).length;
      if (overlap > 0) {
        relevantCount++;
      }
    });

    // Score based on how many findings are relevant to the topic
    return Math.min(0.95, 0.5 + (relevantCount / findings.length) * 0.45);
  }

  /**
   * Detect duplication in findings
   */
  async detectDuplication(findings: string[]): Promise<boolean> {
    if (!findings || findings.length < 3) {
      return false; // Too few findings to detect duplication
    }

    // Use embeddings if available for similarity detection
    if (this.embedder) {
      try {
        const embeddings = await Promise.all(
          findings.map((f) => this.embedder!.embedText(f)),
        );

        // Check for high similarity pairs (potential duplicates)
        for (let i = 0; i < embeddings.length - 1; i++) {
          for (let j = i + 1; j < embeddings.length; j++) {
            const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
            if (similarity > 0.9) {
              // Very high similarity suggests duplication
              return true;
            }
          }
        }
        return false;
      } catch (error) {
        this.logger.warn('Embedding-based duplication detection failed, falling back to text method', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to text-based method
      }
    }

    // Fallback: Text-based duplication detection
    return this.detectDuplicationText(findings);
  }

  /**
   * Text-based duplication detection (fallback method)
   */
  private detectDuplicationText(findings: string[]): boolean {
    // Normalize and compare findings
    const normalized = findings.map((f) =>
      f.toLowerCase().replace(/\s+/g, ' ').trim(),
    );

    for (let i = 0; i < normalized.length - 1; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        // Check for exact or near-exact matches
        if (normalized[i] === normalized[j]) {
          return true;
        }
        // Check for very high character overlap (>90%)
        const longer = normalized[i].length > normalized[j].length ? normalized[i] : normalized[j];
        const shorter = normalized[i].length > normalized[j].length ? normalized[j] : normalized[i];
        if (longer.includes(shorter) && shorter.length / longer.length > 0.9) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check semantic validity of findings
   */
  async checkSemanticValidity(findings: string[]): Promise<boolean> {
    if (!findings || findings.length === 0) {
      return false; // No findings = invalid
    }

    // Basic validity checks
    const validFindings = findings.filter((f) => {
      const trimmed = f.trim();
      // Must have minimum length
      if (trimmed.length < 10) {
        return false;
      }
      // Must not contain error indicators
      if (trimmed.toLowerCase().includes('error') || trimmed.toLowerCase().includes('failed')) {
        return false;
      }
      // Must have some content (not just whitespace/punctuation)
      const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
      if (words.length < 3) {
        return false;
      }
      return true;
    });

    // At least 80% of findings must be valid
    return validFindings.length / findings.length >= 0.8;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0; // Different dimensions = no similarity
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

  /**
   * Generate detailed feedback messages
   */
  private generateFeedback(
    checks: ValidationResult['checks'],
    score: number,
    sourceCount: number,
    findingCount: number,
  ): string[] {
    const feedback: string[] = [];

    if (score >= 0.8) {
      feedback.push('Research validation passed with high confidence');
    } else if (score >= 0.6) {
      feedback.push('Research validation passed');
    } else {
      feedback.push('Research validation found significant issues');
    }

    if (!checks.sourceCredibility) {
      feedback.push(`Source credibility is below threshold (${sourceCount} sources analyzed)`);
    } else if (sourceCount > 0) {
      feedback.push(`Source credibility verified (${sourceCount} sources)`);
    }

    if (!checks.findingConsistency) {
      feedback.push('Findings show inconsistency - may need review');
    } else if (findingCount > 1) {
      feedback.push(`Findings are consistent (${findingCount} findings analyzed)`);
    }

    if (!checks.confidenceLevel) {
      feedback.push('Confidence level is below recommended threshold (0.5)');
    }

    if (!checks.relevanceScore) {
      feedback.push('Relevance score is below threshold - findings may not align with topic');
    }

    if (checks.duplicationDetected) {
      feedback.push('Potential duplication detected in findings - review recommended');
    }

    if (!checks.semanticValidity) {
      feedback.push('Some findings may lack semantic validity - review recommended');
    }

    feedback.push(`Overall validation score: ${(score * 100).toFixed(1)}%`);

    return feedback;
  }
}
