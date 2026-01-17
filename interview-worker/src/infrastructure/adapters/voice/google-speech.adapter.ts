/**
 * Google Speech API Adapter
 *
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) via Google Cloud Speech API.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// Note: In production, would use @google-cloud/speech and @google-cloud/text-to-speech packages

export interface StreamingRecognizer {
  id: string;
  language: string;
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: Error) => void;
}

@Injectable()
export class GoogleSpeechAdapter {
  private readonly logger = new Logger(GoogleSpeechAdapter.name);
  private readonly apiKey?: string;
  private readonly projectId?: string;
  private readonly streamingRecognizers = new Map<
    string,
    {
      recognizer: any;
      buffer: Buffer[];
      language: string;
      onInterimResult?: (text: string) => void;
      onFinalResult?: (text: string) => void;
      onError?: (error: Error) => void;
    }
  >();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_CLOUD_API_KEY');
    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
  }

  /**
   * Convert speech to text using Google Speech-to-Text API
   */
  async speechToText(
    audioBuffer: Buffer,
    language: string = 'en-US',
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    try {
      // Try to use SDK if available
      try {
        const speech = require('@google-cloud/speech');
        const client = new speech.SpeechClient({
          projectId: this.projectId,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });

        const [response] = await client.recognize({
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: language,
          },
          audio: {
            content: audioBuffer.toString('base64'),
          },
        });

        if (response.results && response.results.length > 0) {
          return response.results[0].alternatives[0].transcript;
        }

        throw new Error('No transcription results');
      } catch (sdkError) {
        // SDK not available, use REST API
        this.logger.debug('Google Speech SDK not available, using REST API');
        return this.speechToTextRest(audioBuffer, language);
      }
    } catch (error) {
      this.logger.error('Google Speech STT failed', error);
      throw error;
    }
  }

  /**
   * Speech-to-Text using Google REST API
   */
  private async speechToTextRest(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    const apiUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`;

    const requestBody = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: language,
      },
      audio: {
        content: audioBuffer.toString('base64'),
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Speech recognition failed: ${response.status} - ${errorText}`,
      );
    }

    const result = await response.json();
    if (result.results && result.results.length > 0) {
      return result.results[0].alternatives[0].transcript;
    }

    throw new Error('No transcription results from Google Speech API');
  }

  /**
   * Convert text to speech using Google Text-to-Speech API
   */
  async textToSpeech(
    text: string,
    voice: string = 'en-US-Wavenet-D',
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    try {
      // Try to use SDK if available
      try {
        const textToSpeech = require('@google-cloud/text-to-speech');
        const client = new textToSpeech.TextToSpeechClient({
          projectId: this.projectId,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });

        const languageCode = voice.split('-').slice(0, 2).join('-');
        const [response] = await client.synthesizeSpeech({
          input: { text },
          voice: {
            languageCode,
            name: voice,
          },
          audioConfig: { audioEncoding: 'MP3' },
        });

        return Buffer.from(response.audioContent);
      } catch (sdkError) {
        // SDK not available, use REST API
        this.logger.debug('Google Speech SDK not available, using REST API');
        return this.textToSpeechRest(text, voice);
      }
    } catch (error) {
      this.logger.error('Google Speech TTS failed', error);
      throw error;
    }
  }

  /**
   * Text-to-Speech using Google REST API
   */
  private async textToSpeechRest(text: string, voice: string): Promise<Buffer> {
    const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`;

    const languageCode = voice.split('-').slice(0, 2).join('-');
    const requestBody = {
      input: { text },
      voice: {
        languageCode,
        name: voice,
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Speech synthesis failed: ${response.status} - ${errorText}`,
      );
    }

    const result = await response.json();
    return Buffer.from(result.audioContent, 'base64');
  }

  /**
   * Create a streaming recognizer for real-time transcription
   */
  createStreamingRecognizer(
    language: string = 'en-US',
    config?: {
      onInterimResult?: (text: string) => void;
      onFinalResult?: (text: string) => void;
      onError?: (error: Error) => void;
    },
  ): StreamingRecognizer {
    const id = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Try to use SDK if available
      try {
        const speech = require('@google-cloud/speech');
        const client = new speech.SpeechClient({
          projectId: this.projectId,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });

        const request = {
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: language,
            enableInterimResults: true,
          },
          interimResults: true,
        };

        const recognizeStream = client
          .streamingRecognize(request)
          .on('error', (error: Error) => {
            this.logger.error('Streaming recognition error', error);
            config?.onError?.(error);
          })
          .on('data', (data: any) => {
            if (data.results && data.results.length > 0) {
              const result = data.results[0];
              const transcript = result.alternatives[0].transcript;

              if (result.isFinalTranscript) {
                config?.onFinalResult?.(transcript);
              } else {
                config?.onInterimResult?.(transcript);
              }
            }
          });

        this.streamingRecognizers.set(id, {
          recognizer: recognizeStream,
          buffer: [],
          language,
          onInterimResult: config?.onInterimResult,
          onFinalResult: config?.onFinalResult,
          onError: config?.onError,
        });

        return { id, language };
      } catch (sdkError) {
        // SDK not available, create a mock recognizer that buffers
        this.logger.debug(
          'Google Speech SDK not available, using buffered mode',
        );
        this.streamingRecognizers.set(id, {
          recognizer: null,
          buffer: [],
          language,
          onInterimResult: config?.onInterimResult,
          onFinalResult: config?.onFinalResult,
          onError: config?.onError,
        });

        return { id, language };
      }
    } catch (error) {
      this.logger.error('Failed to create streaming recognizer', error);
      throw error;
    }
  }

  /**
   * Stream an audio chunk to the recognizer
   */
  async streamAudioChunk(
    recognizerId: string,
    audioChunk: Buffer,
  ): Promise<void> {
    const recognizerData = this.streamingRecognizers.get(recognizerId);
    if (!recognizerData) {
      throw new Error(`Streaming recognizer not found: ${recognizerId}`);
    }

    if (recognizerData.recognizer) {
      // SDK mode - write directly to stream
      recognizerData.recognizer.write(audioChunk);
    } else {
      // Buffered mode - accumulate chunks
      recognizerData.buffer.push(audioChunk);

      // Process buffer periodically (every 10 chunks or 1 second)
      if (recognizerData.buffer.length >= 10) {
        await this.processBufferedAudio(recognizerId);
      }
    }
  }

  /**
   * Finalize streaming and get final result
   */
  async finalizeStream(recognizerId: string): Promise<string> {
    const recognizerData = this.streamingRecognizers.get(recognizerId);
    if (!recognizerData) {
      throw new Error(`Streaming recognizer not found: ${recognizerId}`);
    }

    try {
      if (recognizerData.recognizer) {
        // SDK mode - end stream
        recognizerData.recognizer.end();
        // Wait a bit for final results
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        // Buffered mode - process remaining buffer
        if (recognizerData.buffer.length > 0) {
          await this.processBufferedAudio(recognizerId);
        }
      }

      // Clean up
      this.streamingRecognizers.delete(recognizerId);

      return '';
    } catch (error) {
      this.logger.error('Failed to finalize stream', error);
      this.streamingRecognizers.delete(recognizerId);
      throw error;
    }
  }

  /**
   * Process buffered audio (fallback when SDK not available)
   */
  private async processBufferedAudio(recognizerId: string): Promise<void> {
    const recognizerData = this.streamingRecognizers.get(recognizerId);
    if (!recognizerData || recognizerData.buffer.length === 0) {
      return;
    }

    try {
      const audioBuffer = Buffer.concat(recognizerData.buffer);
      recognizerData.buffer = [];

      // Use REST API for transcription
      const transcript = await this.speechToTextRest(
        audioBuffer,
        recognizerData.language,
      );

      // Call interim result callback
      recognizerData.onInterimResult?.(transcript);
    } catch (error) {
      this.logger.error('Failed to process buffered audio', error);
      recognizerData.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
