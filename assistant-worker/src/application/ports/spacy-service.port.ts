/**
 * Spacy Service Port
 *
 * Interface for calling spacy-service for topic categorization enhancement.
 */

export interface TopicCategorizationResult {
  suggestedCategory: string;
  confidence: number;
  keywords: string[];
  entities: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
  }>;
  similarityScores: Record<string, number>;
  reasoning: string;
}

export interface TopicSuggestion {
  category: string;
  score: number;
  type: 'existing' | 'entity_based';
  source?: string;
}

export interface TopicSimilarityResult {
  similarity: number;
  sharedKeywords: string[];
  sharedEntities: Array<{
    text: string;
    label: string;
  }>;
  analysis: string;
}

export interface TopicFeatures {
  keywords: string[];
  entities: Array<{
    text: string;
    label: string;
  }>;
  nounChunks: string[];
  mainVerbs: string[];
  domainIndicators: string[];
  complexityIndicators: {
    wordCount: number;
    sentenceCount: number;
    avgWordLength: number;
    technicalTerms: number;
  };
}

export interface ISpacyService {
  /**
   * Categorize a topic using spaCy semantic analysis
   */
  categorizeTopic(
    topicName: string,
    description?: string,
    existingCategories?: string[],
  ): Promise<TopicCategorizationResult>;

  /**
   * Suggest multiple categories for a topic
   */
  suggestCategories(
    topicName: string,
    description?: string,
    existingCategories?: string[],
    topK?: number,
  ): Promise<TopicSuggestion[]>;

  /**
   * Calculate similarity between two topics
   */
  calculateTopicSimilarity(
    topic1: string,
    topic2: string,
    description1?: string,
    description2?: string,
  ): Promise<TopicSimilarityResult>;

  /**
   * Extract features from a topic
   */
  extractTopicFeatures(
    topicName: string,
    description?: string,
  ): Promise<TopicFeatures>;
}
