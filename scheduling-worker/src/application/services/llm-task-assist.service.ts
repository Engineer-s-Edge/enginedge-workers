import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * LLM Task Assist Response
 */
export interface TaskAssistResponse {
  title: string;
  description?: string;
  estimatedDuration: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  tags?: string[];
  location?: string | null;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    byDay?: string[];
    until?: string;
  } | null;
  suggestedStartTime?: string;
  confidence: number;
}

/**
 * LLM Task Assist Service
 *
 * Integrates with assistant-worker to extract structured task data from natural language
 *
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class LLMTaskAssistService {
  private readonly logger = new Logger(LLMTaskAssistService.name);
  private readonly httpClient: AxiosInstance;
  private readonly assistantWorkerUrl: string;
  private readonly timeout: number = 30000; // 30 second timeout for LLM

  constructor(private readonly configService: ConfigService) {
    // Assistant worker runs on port 3001
    this.assistantWorkerUrl =
      this.configService.get<string>('ASSISTANT_WORKER_URL') ||
      'http://localhost:3001';

    this.httpClient = axios.create({
      baseURL: this.assistantWorkerUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(
      `LLM Task Assist Service initialized with URL: ${this.assistantWorkerUrl}`,
    );
  }

  /**
   * Extract structured task data from natural language description
   */
  async extractTaskData(description: string): Promise<TaskAssistResponse> {
    this.logger.log(
      `Extracting task data from description: ${description.substring(0, 50)}...`,
    );

    try {
      // Call assistant-worker's task-assist agent
      // This would use a specialized agent that extracts task information
      const response = await this.httpClient.post(
        '/assistant/agents/task-assist',
        {
          description,
        },
      );

      // Transform response to our format
      const data = response.data;

      return {
        title: data.title || this.extractTitle(description),
        description: data.description,
        estimatedDuration:
          data.estimatedDuration || this.estimateDuration(description),
        priority: data.priority || this.extractPriority(description),
        category: data.category || this.extractCategory(description),
        tags: data.tags || this.extractTags(description),
        location: data.location || null,
        recurrence: data.recurrence || null,
        suggestedStartTime: data.suggestedStartTime,
        confidence: data.confidence || 0.8,
      };
    } catch (error) {
      this.logger.warn(
        `LLM task assist failed, using fallback extraction: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Fallback to rule-based extraction
      return this.fallbackExtraction(description);
    }
  }

  /**
   * Fallback rule-based extraction when LLM is unavailable
   */
  private fallbackExtraction(description: string): TaskAssistResponse {
    return {
      title: this.extractTitle(description),
      description: description,
      estimatedDuration: this.estimateDuration(description),
      priority: this.extractPriority(description),
      category: this.extractCategory(description),
      tags: this.extractTags(description),
      location: null,
      recurrence: null,
      confidence: 0.6, // Lower confidence for rule-based
    };
  }

  /**
   * Extract title from description (first sentence or first 50 chars)
   */
  private extractTitle(description: string): string {
    const sentences = description.split(/[.!?]/);
    if (sentences.length > 0 && sentences[0].trim().length > 0) {
      return sentences[0].trim();
    }
    return description.substring(0, 50).trim();
  }

  /**
   * Estimate duration from description
   */
  private estimateDuration(description: string): number {
    const lowerDesc = description.toLowerCase();

    // Look for duration patterns
    const hourMatch = lowerDesc.match(/(\d+)\s*hour/i);
    if (hourMatch) {
      return parseInt(hourMatch[1]) * 60;
    }

    const minuteMatch = lowerDesc.match(/(\d+)\s*minute/i);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    // Default estimates based on keywords
    if (lowerDesc.includes('meeting') || lowerDesc.includes('call')) {
      return 30;
    }
    if (lowerDesc.includes('review') || lowerDesc.includes('analysis')) {
      return 60;
    }
    if (lowerDesc.includes('quick') || lowerDesc.includes('brief')) {
      return 15;
    }

    return 30; // Default 30 minutes
  }

  /**
   * Extract priority from description
   */
  private extractPriority(
    description: string,
  ): 'low' | 'medium' | 'high' | 'urgent' {
    const lowerDesc = description.toLowerCase();

    if (
      lowerDesc.includes('urgent') ||
      lowerDesc.includes('asap') ||
      lowerDesc.includes('immediately')
    ) {
      return 'urgent';
    }
    if (
      lowerDesc.includes('high priority') ||
      lowerDesc.includes('important')
    ) {
      return 'high';
    }
    if (lowerDesc.includes('low priority') || lowerDesc.includes('whenever')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Extract category from description
   */
  private extractCategory(description: string): string {
    const lowerDesc = description.toLowerCase();

    if (
      lowerDesc.includes('meeting') ||
      lowerDesc.includes('call') ||
      lowerDesc.includes('standup')
    ) {
      return 'meeting';
    }
    if (
      lowerDesc.includes('work') ||
      lowerDesc.includes('project') ||
      lowerDesc.includes('task')
    ) {
      return 'work';
    }
    if (
      lowerDesc.includes('personal') ||
      lowerDesc.includes('family') ||
      lowerDesc.includes('home')
    ) {
      return 'personal';
    }
    if (
      lowerDesc.includes('exercise') ||
      lowerDesc.includes('workout') ||
      lowerDesc.includes('gym')
    ) {
      return 'health';
    }

    return 'general';
  }

  /**
   * Extract tags from description
   */
  private extractTags(description: string): string[] {
    const tags: string[] = [];
    const lowerDesc = description.toLowerCase();

    // Common tag patterns
    const tagPatterns = [
      { pattern: /#(\w+)/g, extract: (match: RegExpMatchArray) => match[1] },
    ];

    tagPatterns.forEach(({ pattern, extract }) => {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        tags.push(extract(match));
      }
    });

    return tags;
  }
}
