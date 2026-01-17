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
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../../application/services/session.service';
import { CandidateProfileService } from '../../application/services/candidate-profile.service';
import { CodeExecutionService } from '../../application/services/code-execution.service';
import { ITranscriptRepository } from '../../application/ports/repositories.port';
import {
  GoogleSpeechAdapter,
  StreamingRecognizer,
} from '../adapters/voice/google-speech.adapter';
import { AzureSpeechAdapter } from '../adapters/voice/azure-speech.adapter';
import { FillerWordDetectorAdapter } from '../adapters/voice/filler-word-detector.adapter';
import { AudioFormatAdapter } from '../adapters/voice/audio-format.adapter';
import { MongoTestCaseRepository } from '../adapters/database/test-case.repository';

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
  private readonly sessionStartTimes = new Map<string, Date>();
  private readonly streamingRecognizers = new Map<
    string,
    StreamingRecognizer
  >();
  private readonly pushToTalkActive = new Map<string, boolean>();
  private readonly mutedSessions = new Set<string>();
  private readonly agentTTSActive = new Map<string, boolean>();
  private readonly responseTimeTracking = new Map<
    string,
    {
      questionStartTime?: Date;
      responseStartTime?: Date;
      responseEndTime?: Date;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly profileService: CandidateProfileService,
    private readonly codeExecutionService: CodeExecutionService,
    private readonly testCaseRepository: MongoTestCaseRepository,
    private readonly audioFormatAdapter: AudioFormatAdapter,
    @Inject('ITranscriptRepository')
    private readonly transcriptRepository: ITranscriptRepository,
    private readonly fillerWordDetector: FillerWordDetectorAdapter,
  ) {
    // Select speech adapter based on config
    const speechProvider =
      this.configService.get<string>('SPEECH_PROVIDER') || 'google';

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

    if (client.sessionId) {
      // Finalize transcription if buffer exists
      if (this.audioBuffers.has(client.sessionId)) {
        this.finalizeTranscription(client.sessionId);
        this.audioBuffers.delete(client.sessionId);
      }

      // Finalize streaming recognizer
      const recognizer = this.streamingRecognizers.get(client.sessionId);
      if (recognizer) {
        this.speechAdapter.finalizeStream(recognizer.id).catch((error) => {
          this.logger.error('Failed to finalize stream on disconnect', error);
        });
        this.streamingRecognizers.delete(client.sessionId);
      }

      // Clean up session start time
      this.sessionStartTimes.delete(client.sessionId);

      // Clean up voice communication state
      this.pushToTalkActive.delete(client.sessionId);
      this.mutedSessions.delete(client.sessionId);
      this.agentTTSActive.delete(client.sessionId);
      this.responseTimeTracking.delete(client.sessionId);
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
        client.send(
          JSON.stringify({
            type: 'error',
            message: 'Session not found',
          }),
        );
        client.close();
        return;
      }

      client.send(
        JSON.stringify({
          type: 'initialized',
          sessionId: data.sessionId,
          communicationMode: session.communicationMode,
        }),
      );

      // Track session start time for filler word frequency calculation
      this.sessionStartTimes.set(data.sessionId, new Date());

      // Create streaming recognizer for real-time transcription
      if (session.communicationMode === 'voice') {
        const recognizer = this.speechAdapter.createStreamingRecognizer(
          'en-US',
          {
            onInterimResult: (text: string, confidence?: number) => {
              // Send interim result to client with confidence
              client.send(
                JSON.stringify({
                  type: 'transcription-interim',
                  sessionId: data.sessionId,
                  text,
                  confidence,
                }),
              );
            },
            onFinalResult: async (text: string, confidence?: number) => {
              // Add to transcript
              await this.transcriptRepository.appendMessage(data.sessionId, {
                timestamp: new Date(),
                speaker: 'candidate',
                text,
                type: 'voice-transcription',
                confidence,
              });

              // Send final result to client with confidence
              client.send(
                JSON.stringify({
                  type: 'transcription-final',
                  sessionId: data.sessionId,
                  text,
                  confidence,
                }),
              );
            },
            onError: (error: Error) => {
              this.logger.error('Streaming recognition error', error);
              client.send(
                JSON.stringify({
                  type: 'transcription-error',
                  sessionId: data.sessionId,
                  error: error.message,
                }),
              );
            },
          },
        );

        this.streamingRecognizers.set(data.sessionId, recognizer);
      }

      this.logger.log('Session initialized', { sessionId: data.sessionId });
    } catch (error) {
      this.logger.error('Failed to initialize session', error);
      client.send(
        JSON.stringify({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Initialization failed',
        }),
      );
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
      let audioBuffer = Buffer.from(data.audio, 'base64');

      // Normalize audio format using audio format adapter
      try {
        const detectedFormat =
          await this.audioFormatAdapter.detectFormat(audioBuffer);

        // Convert to PCM 16kHz mono if needed (standard for speech recognition)
        if (
          detectedFormat.format !== 'pcm' ||
          detectedFormat.sampleRate !== 16000 ||
          detectedFormat.channels !== 1
        ) {
          // First convert to WAV if not already
          if (detectedFormat.format !== 'wav') {
            audioBuffer = await this.audioFormatAdapter.convertFormat(
              audioBuffer,
              detectedFormat.format,
              'wav',
            );
          }

          // Convert sample rate if needed
          if (detectedFormat.sampleRate !== 16000) {
            audioBuffer = await this.audioFormatAdapter.convertSampleRate(
              audioBuffer,
              detectedFormat.sampleRate,
              16000,
            );
          }

          // Convert channels if needed
          if (detectedFormat.channels !== 1) {
            audioBuffer = await this.audioFormatAdapter.convertChannels(
              audioBuffer,
              detectedFormat.channels,
              1,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          'Audio format conversion failed, using original',
          error,
        );
      }

      // Check if muted
      if (this.mutedSessions.has(sessionId)) {
        return; // Ignore audio if muted
      }

      // Use streaming recognition if available
      const recognizer = this.streamingRecognizers.get(sessionId);
      if (recognizer) {
        await this.speechAdapter.streamAudioChunk(recognizer.id, audioBuffer);

        // Detect interruption (user speaking while agent TTS is active)
        if (this.agentTTSActive.get(sessionId)) {
          this.pauseAgentTTS(sessionId);
        }
      } else {
        // Fallback to buffered mode
        if (!this.audioBuffers.has(sessionId)) {
          this.audioBuffers.set(sessionId, []);
        }
        this.audioBuffers.get(sessionId)!.push(audioBuffer);

        // Every N chunks or after delay, transcribe
        const buffer = this.audioBuffers.get(sessionId)!;
        if (buffer.length >= 10) {
          // Transcribe every 10 chunks (configurable)
          await this.transcribeAudioChunk(sessionId, Buffer.concat(buffer));
          this.audioBuffers.set(sessionId, []); // Clear buffer
        }
      }

      client.send(
        JSON.stringify({
          type: 'audio-received',
        }),
      );
    } catch (error) {
      this.logger.error('Failed to process audio', error);
      client.send(
        JSON.stringify({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Audio processing failed',
        }),
      );
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

      client.send(
        JSON.stringify({
          type: 'message-received',
        }),
      );
    } catch (error) {
      this.logger.error('Failed to process message', error);
      client.send(
        JSON.stringify({
          type: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Message processing failed',
        }),
      );
    }
  }

  /**
   * Transcribe audio chunk and add to transcript
   */
  private async transcribeAudioChunk(
    sessionId: string,
    audioBuffer: Buffer,
  ): Promise<void> {
    try {
      const session = await this.sessionService.getSession(sessionId);
      if (!session) return;

      // Use speech adapter to transcribe
      const transcription = await this.speechAdapter.speechToText(
        audioBuffer,
        'en-US',
      );

      // Calculate duration for frequency analysis
      const sessionStart = this.sessionStartTimes.get(sessionId);
      const durationSeconds = sessionStart
        ? (Date.now() - sessionStart.getTime()) / 1000
        : 60.0;

      // Detect filler words using ML service with fallback
      const fillerAnalysis = await this.fillerWordDetector.detectFillerWords(
        transcription,
        durationSeconds,
      );

      // Add to transcript
      await this.transcriptRepository.appendMessage(sessionId, {
        timestamp: new Date(),
        speaker: 'candidate',
        text: transcription,
        type: 'voice-transcription',
      });

      // If fillers detected, add observation with frequency info
      if (
        fillerAnalysis.fillers.length > 0 &&
        session.communicationMode === 'voice'
      ) {
        const observationMessage =
          fillerAnalysis.frequency > 5
            ? `High frequency of filler words (${fillerAnalysis.frequency.toFixed(1)}/min): ${fillerAnalysis.fillers.join(', ')}`
            : `Used filler words: ${fillerAnalysis.fillers.join(', ')}`;

        await this.profileService.appendObservation(
          sessionId,
          'concerns',
          observationMessage,
        );
      }

      // Broadcast transcription to client with enhanced filler analysis
      this.server.clients.forEach((client) => {
        const ws = client as InterviewSocket;
        if (ws.sessionId === sessionId) {
          ws.send(
            JSON.stringify({
              type: 'transcription',
              text: transcription,
              fillerWords: fillerAnalysis.fillers,
              fillerAnalysis: {
                frequency: fillerAnalysis.frequency,
                confidence: fillerAnalysis.confidence,
                patterns: fillerAnalysis.patterns,
              },
            }),
          );
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
   * Send agent response as audio (TTS)
   */
  async sendAgentAudio(sessionId: string, text: string): Promise<Buffer> {
    try {
      const audioBuffer = await this.speechAdapter.textToSpeech(text);

      // Mark agent TTS as active
      this.agentTTSActive.set(sessionId, true);

      // Broadcast audio to client
      this.server.clients.forEach((client) => {
        const ws = client as InterviewSocket;
        if (ws.sessionId === sessionId) {
          ws.send(
            JSON.stringify({
              type: 'agent-audio',
              audio: audioBuffer.toString('base64'),
            }),
          );
        }
      });

      // Mark as inactive after audio completes (simplified - would need actual TTS duration)
      setTimeout(() => {
        this.agentTTSActive.set(sessionId, false);
      }, 5000);

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

  /**
   * Handle code execution request
   */
  @SubscribeMessage('execute-code')
  async handleCodeExecution(
    @MessageBody()
    data: {
      sessionId: string;
      questionId: string;
      code: string;
      language: string;
      responseId?: string;
    },
    @ConnectedSocket() client: InterviewSocket,
  ) {
    try {
      const sessionId = data.sessionId || client.sessionId;
      if (!sessionId) {
        throw new Error('Session ID required');
      }

      // Notify execution started
      client.send(
        JSON.stringify({
          type: 'code-execution-started',
          sessionId,
          questionId: data.questionId,
        }),
      );

      // Get test cases
      const testCases = await this.testCaseRepository.findByQuestionId(
        data.questionId,
      );

      // Execute code
      const execution = await this.codeExecutionService.executeCode({
        code: data.code,
        language: data.language,
        testCases,
        responseId: data.responseId || '',
        sessionId,
        questionId: data.questionId,
      });

      // Send results
      if (execution.status === 'completed') {
        client.send(
          JSON.stringify({
            type: 'code-execution-completed',
            sessionId,
            executionId: execution.id,
            passedTests: execution.passedTests,
            totalTests: execution.totalTests,
            testResults: execution.testResults,
            executionTime: execution.executionTime,
          }),
        );
      } else {
        client.send(
          JSON.stringify({
            type: 'code-execution-failed',
            sessionId,
            executionId: execution.id,
            error: execution.error,
          }),
        );
      }
    } catch (error) {
      this.logger.error('Code execution failed', error);
      client.send(
        JSON.stringify({
          type: 'code-execution-failed',
          sessionId: data.sessionId,
          error:
            error instanceof Error ? error.message : 'Code execution failed',
        }),
      );
    }
  }

  /**
   * Push-to-Talk: Start recording
   */
  @SubscribeMessage('voice-push-to-talk-start')
  async handlePushToTalkStart(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: InterviewSocket,
  ): Promise<void> {
    const sessionId = data.sessionId || client.sessionId;
    if (!sessionId) return;

    this.pushToTalkActive.set(sessionId, true);

    // Pause agent TTS if active
    if (this.agentTTSActive.get(sessionId)) {
      this.pauseAgentTTS(sessionId);
    }

    // Track response start time
    const tracking = this.responseTimeTracking.get(sessionId) || {};
    tracking.responseStartTime = new Date();
    this.responseTimeTracking.set(sessionId, tracking);

    client.send(
      JSON.stringify({
        type: 'push-to-talk-started',
        sessionId,
      }),
    );
  }

  /**
   * Push-to-Talk: Stop recording and send
   */
  @SubscribeMessage('voice-push-to-talk-stop')
  async handlePushToTalkStop(
    @MessageBody() data: { sessionId: string; audio?: string },
    @ConnectedSocket() client: InterviewSocket,
  ): Promise<void> {
    const sessionId = data.sessionId || client.sessionId;
    if (!sessionId) return;

    this.pushToTalkActive.set(sessionId, false);

    // Track response end time
    const tracking = this.responseTimeTracking.get(sessionId) || {};
    tracking.responseEndTime = new Date();
    this.responseTimeTracking.set(sessionId, tracking);

    // Calculate response time
    if (tracking.questionStartTime && tracking.responseStartTime) {
      const responseTime =
        tracking.responseStartTime.getTime() -
        tracking.questionStartTime.getTime();
      // Store in candidate profile
      await this.profileService.appendObservation(
        sessionId,
        'keyInsights',
        `Response time: ${Math.floor(responseTime / 1000)}s`,
      );
    }

    // Resume agent TTS if it was paused
    if (this.agentTTSActive.get(sessionId)) {
      this.resumeAgentTTS(sessionId);
    }

    // Process audio if provided
    if (data.audio) {
      await this.handleAudio(
        {
          audio: data.audio,
          sessionId,
        },
        client,
      );
    }

    client.send(
      JSON.stringify({
        type: 'push-to-talk-stopped',
        sessionId,
      }),
    );
  }

  /**
   * Mute microphone
   */
  @SubscribeMessage('voice-mute')
  async handleMute(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: InterviewSocket,
  ): Promise<void> {
    const sessionId = data.sessionId || client.sessionId;
    if (!sessionId) return;

    this.mutedSessions.add(sessionId);

    client.send(
      JSON.stringify({
        type: 'voice-muted',
        sessionId,
      }),
    );
  }

  /**
   * Unmute microphone
   */
  @SubscribeMessage('voice-unmute')
  async handleUnmute(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: InterviewSocket,
  ): Promise<void> {
    const sessionId = data.sessionId || client.sessionId;
    if (!sessionId) return;

    this.mutedSessions.delete(sessionId);

    client.send(
      JSON.stringify({
        type: 'voice-unmuted',
        sessionId,
      }),
    );
  }

  /**
   * Pause agent TTS when user starts speaking
   */
  private pauseAgentTTS(sessionId: string): void {
    this.agentTTSActive.set(sessionId, false);
    this.server.clients.forEach((client: any) => {
      if (client.sessionId === sessionId) {
        client.send(
          JSON.stringify({
            type: 'agent-tts-paused',
            sessionId,
            reason: 'user-interruption',
          }),
        );
      }
    });
  }

  /**
   * Resume agent TTS after user finishes
   */
  private resumeAgentTTS(sessionId: string): void {
    this.agentTTSActive.set(sessionId, true);
    this.server.clients.forEach((client: any) => {
      if (client.sessionId === sessionId) {
        client.send(
          JSON.stringify({
            type: 'agent-tts-resumed',
            sessionId,
          }),
        );
      }
    });
  }

  /**
   * Track question start time for response time calculation
   */
  trackQuestionStart(sessionId: string): void {
    const tracking = this.responseTimeTracking.get(sessionId) || {};
    tracking.questionStartTime = new Date();
    tracking.responseStartTime = undefined;
    tracking.responseEndTime = undefined;
    this.responseTimeTracking.set(sessionId, tracking);
  }

  /**
   * Get response time tracking data
   */
  getResponseTimeTracking(sessionId: string): {
    questionStartTime?: Date;
    responseStartTime?: Date;
    responseEndTime?: Date;
  } {
    return this.responseTimeTracking.get(sessionId) || {};
  }
}
