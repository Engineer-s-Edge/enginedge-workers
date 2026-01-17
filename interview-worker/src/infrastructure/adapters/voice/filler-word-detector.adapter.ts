/**
 * Filler Word Detector Adapter
 *
 * Detects filler words in speech transcriptions using ML service (spacy-service)
 * with fallback to regex-based detection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FillerWordAnalysis {
  fillers: string[];
  frequency: number; // fillers per minute
  confidence: number; // 0-1
  patterns: string[];
  totalWords: number;
  fillerCount: number;
}

@Injectable()
export class FillerWordDetectorAdapter {
  private readonly logger = new Logger(FillerWordDetectorAdapter.name);
  private readonly nlpServiceUrl: string;
  private readonly fallbackFillers = [
    'um',
    'uh',
    'ah',
    'like',
    'you know',
    'so',
    'well',
    'er',
    'actually',
    'basically',
    'literally',
    'right',
    'okay',
    'ok',
    'yeah',
    'yep',
  ];

  constructor(private readonly configService: ConfigService) {
    this.nlpServiceUrl =
      this.configService.get<string>('SPACY_SERVICE_URL') ||
      'http://localhost:8001';
  }

  /**
   * Detect filler words in transcription text
   * @param text Transcription text
   * @param durationSeconds Duration of speech in seconds (for frequency calculation)
   * @returns Filler word analysis
   */
  async detectFillerWords(
    text: string,
    durationSeconds: number = 60.0,
  ): Promise<FillerWordAnalysis> {
    // Try ML service first
    try {
      const response = await fetch(`${this.nlpServiceUrl}/analyze-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          durationSeconds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        this.logger.debug('Filler word detection via ML service', {
          fillers: result.fillers,
          frequency: result.frequency,
        });
        return {
          fillers: result.fillers || [],
          frequency: result.frequency || 0,
          confidence: result.confidence || 0.5,
          patterns: result.patterns || [],
          totalWords: result.totalWords || 0,
          fillerCount: result.fillerCount || 0,
        };
      }
    } catch (error) {
      this.logger.warn(
        `ML service unavailable, falling back to regex: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Fallback to regex-based detection
    return this.detectFillerWordsRegex(text, durationSeconds);
  }

  /**
   * Regex-based filler word detection (fallback)
   */
  private detectFillerWordsRegex(
    text: string,
    durationSeconds: number,
  ): FillerWordAnalysis {
    const detected: string[] = [];
    const lowerText = text.toLowerCase();

    this.fallbackFillers.forEach((filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        detected.push(...matches);
      }
    });

    const uniqueFillers = [...new Set(detected)];
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const durationMinutes = durationSeconds / 60.0 || 1.0;
    const frequency = uniqueFillers.length / durationMinutes;

    // Detect repetitive patterns (same filler repeated)
    const patterns: string[] = [];
    const fillerPositions: number[] = [];
    words.forEach((word, index) => {
      if (this.fallbackFillers.includes(word.toLowerCase())) {
        fillerPositions.push(index);
      }
    });

    for (let i = 0; i < fillerPositions.length - 1; i++) {
      const pos1 = fillerPositions[i];
      const pos2 = fillerPositions[i + 1];
      if (pos2 - pos1 <= 5) {
        const filler1 = words[pos1].toLowerCase();
        const filler2 = words[pos2].toLowerCase();
        if (filler1 === filler2) {
          patterns.push(`${filler1} (repeated)`);
        }
      }
    }

    return {
      fillers: uniqueFillers,
      frequency: Math.round(frequency * 100) / 100,
      confidence: 0.5, // Lower confidence for regex fallback
      patterns: [...new Set(patterns)],
      totalWords: words.length,
      fillerCount: detected.length,
    };
  }
}
