/**
 * Interview WebSocket Gateway
 * 
 * Handles real-time audio streaming and interview communication via WebSocket.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../../application/services/session.service';
import { CandidateProfileService } from '../../application/services/candidate-profile.service';
import { ITranscriptRepository } from '../../application/ports/repositories.port';
import { GoogleSpeechAdapter } from '../adapters/voice/google-speech.adapter';
import { AzureSpeechAdapter } from '../adapters/voice/azure-speech.adapter';

interface InterviewSocket extends WebSocket {
  sessionId?: string;
  candidateId?: string;
  audioBuffer?: Buffer[];
}

@WebSocketGateway({
  path: '/interview',
  cors: {
    origin: '*',
  },
})
export class InterviewWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InterviewWebSocketGateway.name);
  private readonly speechAdapter: GoogleSpeechAdapter | AzureSpeechAdapter;
  private readonly audioBuffers = new Map<string, Buffer[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly profileService: CandidateProfileService,
    @Inject('ITranscriptRepository')
    private readonly transcriptRepository: ITranscriptRepository,
  ) {
    // Select speech adapter based on config
    const speechProvider = this.configService.get<string>('SPEECH_PROVIDER') || 'google';
    
    if (speechProvider === 'azure') {
      this.speechAdapter = new AzureSpeechAdapter(this.configService);
    } else {
      this.speechAdapter = new GoogleSpeechAdapter(this.configService);
    }
  }

  handleConnection(client: InterviewSocket) {
    this.logger.log('Client connected', { clientId: client.url });
  }

  handleDisconnect(client: InterviewSocket) {
    this.logger.log('Client disconnected', { sessionId: client.sessionId });
    
    // Finalize transcription if buffer exists
    if (client.sessionId && this.audioBuffers.has(client.sessionId)) {
      this.finalizeTranscription(client.sessionId);
      this.audioBuffers.delete(client.sessionId);
    }
  }

  /**
   * Initialize interview session connection
   */
  @SubscribeMessage('init')
  async handleInit(
    @MessageBody() data: { sessionId: string; candidateId: string },
    @ConnectedSocket() client: InterviewSocket,
  ) {
    try {
      client.sessionId = data.sessionId;
      client.candidateId = data.candidateId;
      
      // Initialize audio buffer for this session
      this.audioBuffers.set(data.sessionId, []);
      client.audioBuffer = [];

      // Verify session exists
      const session = await this.sessionService.getSession(data.sessionId);
      if (!session) {
        client.send(JSON.stringify({
          type: 'error',
          message: 'Session not found',
        }));
        client.close();
        return;
      }

      client.send(JSON.stringify({
        type: 'initialized',
        sessionId: data.sessionId,
        communicationMode: session.communicationMode,
      }));

      this.logger.log('Session initialized', { sessionId: data.sessionId });
    } catch (error) {
      this.logger.error('Failed to initialize session', error);
      client.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Initialization failed',
      }));
    }
  }

  /**
   * Handle incoming audio chunks
   */
  @SubscribeMessage('audio')
  async handleAudio(
    @MessageBody() data: { audio: string; sessionId: string }, // audio is base64 encoded
    @ConnectedSocket() client: InterviewSocket,
  ) {
    try {
      const sessionId = data.sessionId || client.sessionId;
      if (!sessionId) {
        throw new Error('Session ID required');
      }

      // Decode base64 audio
      const audioBuffer = Buffer.from(data.audio, 'base64');
      
      // Accumulate audio buffer
      if (!this.audioBuffers.has(sessionId)) {
        this.audioBuffers.set(sessionId, []);
      }
      this.audioBuffers.get(sessionId)!.push(audioBuffer);

      // Every N chunks or after delay, transcribe
      const buffer = this.audioBuffers.get(sessionId)!;
      if (buffer.length >= 10) { // Transcribe every 10 chunks (configurable)
        await this.transcribeAudioChunk(sessionId, Buffer.concat(buffer));
        this.audioBuffers.set(sessionId, []); // Clear buffer
      }

      client.send(JSON.stringify({
        type: 'audio-received',
      }));
    } catch (error) {
      this.logger.error('Failed to process audio', error);
      client.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Audio processing failed',
      }));
    }
  }

  /**
   * Handle text messages (fallback for text mode)
   */
  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: { text: string; sessionId: string },
    @ConnectedSocket() client: InterviewSocket,
  ) {
    try {
      const sessionId = data.sessionId || client.sessionId;
      if (!sessionId) {
        throw new Error('Session ID required');
      }

      // Add to transcript
      await this.transcriptRepository.appendMessage(sessionId, {
        timestamp: new Date(),
        speaker: 'candidate',
        text: data.text,
        type: 'user-input',
      });

      client.send(JSON.stringify({
        type: 'message-received',
      }));
    } catch (error) {
      this.logger.error('Failed to process message', error);
      client.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Message processing failed',
      }));
    }
  }

  /**
   * Transcribe audio chunk and add to transcript
   */
  private async transcribeAudioChunk(sessionId: string, audioBuffer: Buffer): Promise<void> {
    try {
      const session = await this.sessionService.getSession(sessionId);
      if (!session) return;

      // Use speech adapter to transcribe
      const transcription = await this.speechAdapter.speechToText(
        audioBuffer,
        'en-US', // Could be configurable
      );

      // Detect filler words (simple regex for now)
      const fillerWords = this.detectFillerWords(transcription);

      // Add to transcript
      await this.transcriptRepository.appendMessage(sessionId, {
        timestamp: new Date(),
        speaker: 'candidate',
        text: transcription,
        type: 'voice-transcription',
      });

      // If fillers detected, add observation
      if (fillerWords.length > 0 && session.communicationMode === 'voice') {
        await this.profileService.appendObservation(
          sessionId,
          'concerns',
          `Used filler words during speech: ${fillerWords.join(', ')}`,
        );
      }

      // Broadcast transcription to client
      this.server.clients.forEach((client) => {
        const ws = client as InterviewSocket;
        if (ws.sessionId === sessionId) {
          ws.send(JSON.stringify({
            type: 'transcription',
            text: transcription,
            fillerWords,
          }));
        }
      });
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error);
    }
  }

  /**
   * Finalize transcription on disconnect
   */
  private async finalizeTranscription(sessionId: string): Promise<void> {
    const buffer = this.audioBuffers.get(sessionId);
    if (buffer && buffer.length > 0) {
      await this.transcribeAudioChunk(sessionId, Buffer.concat(buffer));
    }
  }

  /**
   * Detect filler words in transcription
   */
  private detectFillerWords(text: string): string[] {
    const fillers = ['um', 'uh', 'ah', 'like', 'you know', 'so', 'well', 'er'];
    const detected: string[] = [];
    const lowerText = text.toLowerCase();

    fillers.forEach((filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        detected.push(...matches);
      }
    });

    return [...new Set(detected)]; // Remove duplicates
  }

  /**
   * Send agent response as audio (TTS)
   */
  async sendAgentAudio(sessionId: string, text: string): Promise<Buffer> {
    try {
      const audioBuffer = await this.speechAdapter.textToSpeech(text);
      
      // Broadcast audio to client
      this.server.clients.forEach((client) => {
        const ws = client as InterviewSocket;
        if (ws.sessionId === sessionId) {
          ws.send(JSON.stringify({
            type: 'agent-audio',
            audio: audioBuffer.toString('base64'),
          }));
        }
      });

      // Also add to transcript
      await this.transcriptRepository.appendMessage(sessionId, {
        timestamp: new Date(),
        speaker: 'agent',
        text,
        type: 'agent-response',
      });

      return audioBuffer;
    } catch (error) {
      this.logger.error('Failed to send agent audio', error);
      throw error;
    }
  }
}

