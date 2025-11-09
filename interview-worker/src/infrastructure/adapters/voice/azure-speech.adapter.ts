/**
 * Azure Speech Service Adapter
 *
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) via Azure Cognitive Services Speech.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// Note: In production, would use microsoft-cognitiveservices-speech-sdk package

import { StreamingRecognizer } from './google-speech.adapter';

@Injectable()
export class AzureSpeechAdapter {
  private readonly logger = new Logger(AzureSpeechAdapter.name);
  private readonly subscriptionKey?: string;
  private readonly region?: string;
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
    this.subscriptionKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    this.region =
      this.configService.get<string>('AZURE_SPEECH_REGION') || 'eastus';
  }

  /**
   * Convert speech to text using Azure Speech-to-Text
   */
  async speechToText(
    audioBuffer: Buffer,
    language: string = 'en-US',
  ): Promise<string> {
    if (!this.subscriptionKey) {
      throw new Error('Azure Speech subscription key not configured');
    }

    try {
      // Try to use SDK if available
      try {
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        const speechConfig = sdk.SpeechConfig.fromSubscription(
          this.subscriptionKey,
          this.region,
        );
        speechConfig.speechRecognitionLanguage = language;

        // Create audio config from buffer
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(audioBuffer);
        pushStream.close();
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        const result = await new Promise<string>((resolve, reject) => {
          recognizer.recognizeOnceAsync(
            (result: any) => {
              recognizer.close();
              if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                resolve(result.text);
              } else {
                reject(new Error(`Recognition failed: ${result.reason}`));
              }
            },
            (error: any) => {
              recognizer.close();
              reject(error);
            },
          );
        });

        return result;
      } catch (sdkError) {
        // SDK not available, use REST API
        this.logger.debug('Azure Speech SDK not available, using REST API');
        return this.speechToTextRest(audioBuffer, language);
      }
    } catch (error) {
      this.logger.error('Azure Speech STT failed', error);
      throw error;
    }
  }

  /**
   * Speech-to-Text using Azure REST API
   */
  private async speechToTextRest(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    // Get access token
    const tokenUrl = `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey!,
      },
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Failed to get Azure Speech token: ${tokenResponse.statusText}`,
      );
    }

    const token = await tokenResponse.text();

    // Perform recognition
    const recognitionUrl = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
    const recognitionResponse = await fetch(recognitionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    });

    if (!recognitionResponse.ok) {
      const errorText = await recognitionResponse.text();
      throw new Error(
        `Azure Speech recognition failed: ${recognitionResponse.status} - ${errorText}`,
      );
    }

    const result = await recognitionResponse.json();
    return result.DisplayText || result.Text || '';
  }

  /**
   * Convert text to speech using Azure Text-to-Speech
   */
  async textToSpeech(
    text: string,
    voice: string = 'en-US-JennyNeural',
  ): Promise<Buffer> {
    if (!this.subscriptionKey) {
      throw new Error('Azure Speech subscription key not configured');
    }

    try {
      // Try to use SDK if available
      try {
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        const speechConfig = sdk.SpeechConfig.fromSubscription(
          this.subscriptionKey,
          this.region,
        );
        speechConfig.speechSynthesisVoiceName = voice;

        const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

        const result = await new Promise<Buffer>((resolve, reject) => {
          synthesizer.speakTextAsync(
            text,
            (result: any) => {
              synthesizer.close();
              if (
                result.reason === sdk.ResultReason.SynthesizingAudioCompleted
              ) {
                resolve(Buffer.from(result.audioData));
              } else {
                reject(new Error(`Synthesis failed: ${result.reason}`));
              }
            },
            (error: any) => {
              synthesizer.close();
              reject(error);
            },
          );
        });

        return result;
      } catch (sdkError) {
        // SDK not available, use REST API
        this.logger.debug('Azure Speech SDK not available, using REST API');
        return this.textToSpeechRest(text, voice);
      }
    } catch (error) {
      this.logger.error('Azure Speech TTS failed', error);
      throw error;
    }
  }

  /**
   * Text-to-Speech using Azure REST API
   */
  private async textToSpeechRest(text: string, voice: string): Promise<Buffer> {
    // Get access token
    const tokenUrl = `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey!,
      },
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Failed to get Azure Speech token: ${tokenResponse.statusText}`,
      );
    }

    const token = await tokenResponse.text();

    // Perform synthesis
    const synthesisUrl = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='${voice}'>${text}</voice></speak>`;

    const synthesisResponse = await fetch(synthesisUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!synthesisResponse.ok) {
      const errorText = await synthesisResponse.text();
      throw new Error(
        `Azure Speech synthesis failed: ${synthesisResponse.status} - ${errorText}`,
      );
    }

    const audioArrayBuffer = await synthesisResponse.arrayBuffer();
    return Buffer.from(audioArrayBuffer);
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
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        const speechConfig = sdk.SpeechConfig.fromSubscription(
          this.subscriptionKey!,
          this.region!,
        );
        speechConfig.speechRecognitionLanguage = language;

        const audioConfig = sdk.AudioConfig.fromStreamInput(
          sdk.AudioInputStream.createPushStream(),
        );

        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognizing = (s: any, e: any) => {
          if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
            config?.onInterimResult?.(e.result.text);
          }
        };

        recognizer.recognized = (s: any, e: any) => {
          if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
            config?.onFinalResult?.(e.result.text);
          }
        };

        recognizer.canceled = (s: any, e: any) => {
          const error = new Error(`Recognition canceled: ${e.errorDetails}`);
          this.logger.error('Streaming recognition canceled', error);
          config?.onError?.(error);
        };

        recognizer.sessionStopped = () => {
          recognizer.stopContinuousRecognitionAsync();
        };

        recognizer.startContinuousRecognitionAsync();

        this.streamingRecognizers.set(id, {
          recognizer,
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
          'Azure Speech SDK not available, using buffered mode',
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
      // SDK mode - write to push stream
      try {
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        const pushStream = recognizerData.recognizer.audioInputStream;
        if (pushStream) {
          pushStream.write(audioChunk);
        }
      } catch (error) {
        this.logger.error('Failed to write to Azure stream', error);
      }
    } else {
      // Buffered mode - accumulate chunks
      recognizerData.buffer.push(audioChunk);

      // Process buffer periodically (every 10 chunks)
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
        // SDK mode - stop recognition
        const sdk = require('microsoft-cognitiveservices-speech-sdk');
        recognizerData.recognizer.stopContinuousRecognitionAsync(() => {
          recognizerData.recognizer.close();
        });
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
