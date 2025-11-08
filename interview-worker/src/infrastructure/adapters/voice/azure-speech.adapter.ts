/**
 * Azure Speech Service Adapter
 *
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) via Azure Cognitive Services Speech.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// Note: In production, would use microsoft-cognitiveservices-speech-sdk package

@Injectable()
export class AzureSpeechAdapter {
  private readonly logger = new Logger(AzureSpeechAdapter.name);
  private readonly subscriptionKey?: string;
  private readonly region?: string;

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
}
