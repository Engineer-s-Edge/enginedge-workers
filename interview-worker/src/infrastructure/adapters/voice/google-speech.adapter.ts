/**
 * Google Speech API Adapter
 *
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) via Google Cloud Speech API.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// Note: In production, would use @google-cloud/speech and @google-cloud/text-to-speech packages

@Injectable()
export class GoogleSpeechAdapter {
  private readonly logger = new Logger(GoogleSpeechAdapter.name);
  private readonly apiKey?: string;
  private readonly projectId?: string;

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
}
