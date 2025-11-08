/**
 * Spacy Service Adapter
 *
 * Calls spacy-service for topic categorization enhancement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISpacyService,
  TopicCategorizationResult,
  TopicSuggestion,
  TopicSimilarityResult,
  TopicFeatures,
} from '@application/ports/spacy-service.port';

@Injectable()
export class SpacyServiceAdapter implements ISpacyService {
  private readonly logger = new Logger(SpacyServiceAdapter.name);
  private readonly spacyServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.spacyServiceUrl =
      this.configService.get<string>('SPACY_SERVICE_URL') ||
      'http://localhost:8001';
  }

  async categorizeTopic(
    topicName: string,
    description?: string,
    existingCategories?: string[],
  ): Promise<TopicCategorizationResult> {
    try {
      const response = await fetch(`${this.spacyServiceUrl}/categorize-topic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName,
          description,
          existingCategories,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Spacy service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return {
        suggestedCategory: result.suggestedCategory,
        confidence: result.confidence,
        keywords: result.keywords || [],
        entities: result.entities || [],
        similarityScores: result.similarityScores || {},
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      this.logger.warn(
        `Error calling spacy service for categorization: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return fallback result
      return {
        suggestedCategory: 'Uncategorized',
        confidence: 0.3,
        keywords: [],
        entities: [],
        similarityScores: {},
        reasoning: 'Spacy service unavailable, using fallback',
      };
    }
  }

  async suggestCategories(
    topicName: string,
    description?: string,
    existingCategories?: string[],
    topK: number = 5,
  ): Promise<TopicSuggestion[]> {
    try {
      const response = await fetch(
        `${this.spacyServiceUrl}/suggest-categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topicName,
            description,
            existingCategories,
            topK,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Spacy service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return result.suggestions || [];
    } catch (error) {
      this.logger.warn(
        `Error calling spacy service for suggestions: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async calculateTopicSimilarity(
    topic1: string,
    topic2: string,
    description1?: string,
    description2?: string,
  ): Promise<TopicSimilarityResult> {
    try {
      const response = await fetch(`${this.spacyServiceUrl}/topic-similarity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic1,
          topic2,
          description1,
          description2,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Spacy service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return {
        similarity: result.similarity || 0,
        sharedKeywords: result.sharedKeywords || [],
        sharedEntities: result.sharedEntities || [],
        analysis: result.analysis || '',
      };
    } catch (error) {
      this.logger.warn(
        `Error calling spacy service for similarity: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        similarity: 0,
        sharedKeywords: [],
        sharedEntities: [],
        analysis: 'Spacy service unavailable',
      };
    }
  }

  async extractTopicFeatures(
    topicName: string,
    description?: string,
  ): Promise<TopicFeatures> {
    try {
      const response = await fetch(
        `${this.spacyServiceUrl}/extract-topic-features`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topicName,
            description,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Spacy service returned error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return {
        keywords: result.keywords || [],
        entities: result.entities || [],
        nounChunks: result.nounChunks || [],
        mainVerbs: result.mainVerbs || [],
        domainIndicators: result.domainIndicators || [],
        complexityIndicators: result.complexityIndicators || {
          wordCount: 0,
          sentenceCount: 0,
          avgWordLength: 0,
          technicalTerms: 0,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Error calling spacy service for features: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        keywords: [],
        entities: [],
        nounChunks: [],
        mainVerbs: [],
        domainIndicators: [],
        complexityIndicators: {
          wordCount: 0,
          sentenceCount: 0,
          avgWordLength: 0,
          technicalTerms: 0,
        },
      };
    }
  }
}
