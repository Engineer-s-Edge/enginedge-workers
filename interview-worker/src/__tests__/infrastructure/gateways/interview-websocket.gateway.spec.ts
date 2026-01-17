/**
 * Interview WebSocket Gateway Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InterviewWebSocketGateway } from '../../../infrastructure/gateways/interview-websocket.gateway';
import { SessionService } from '../../../application/services/session.service';
import { CandidateProfileService } from '../../../application/services/candidate-profile.service';
import { GoogleSpeechAdapter } from '../../../infrastructure/adapters/voice/google-speech.adapter';
import { AzureSpeechAdapter } from '../../../infrastructure/adapters/voice/azure-speech.adapter';
import { CodeExecutionService } from '../../../application/services/code-execution.service';
import { MongoTestCaseRepository } from '../../../infrastructure/adapters/database/test-case.repository';
import { AudioFormatAdapter } from '../../../infrastructure/adapters/voice/audio-format.adapter';
import { FillerWordDetectorAdapter } from '../../../infrastructure/adapters/voice/filler-word-detector.adapter';
import { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';
import { ITranscriptRepository } from '../../../application/ports/repositories.port';

// Mock Google Cloud Speech
jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    recognize: jest.fn().mockResolvedValue([{ results: [] }]),
    streamingRecognize: jest.fn().mockReturnValue({
      write: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      removeListener: jest.fn(),
    }),
    close: jest.fn(),
  })),
}));

// Mock Google Cloud Text-to-Speech
jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: jest
      .fn()
      .mockResolvedValue([{ audioContent: Buffer.from('test-audio') }]),
    close: jest.fn(),
  })),
}));

describe('InterviewWebSocketGateway', () => {
  let gateway: InterviewWebSocketGateway;
  let mockSessionService: any;
  let mockProfileService: any;
  let mockConfigService: any;
  const mockTranscriptRepository = mock<ITranscriptRepository>();

  beforeEach(async () => {
    mockSessionService = {
      getSession: jest.fn(),
    };

    mockProfileService = {
      appendObservation: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'SPEECH_PROVIDER') return 'google';
        if (key === 'GOOGLE_CLOUD_API_KEY') return 'test-key';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewWebSocketGateway,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: CandidateProfileService,
          useValue: mockProfileService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'ITranscriptRepository',
          useValue: mockTranscriptRepository,
        },
        {
          provide: CodeExecutionService,
          useValue: mock<CodeExecutionService>(),
        },
        {
          provide: MongoTestCaseRepository,
          useValue: mock<MongoTestCaseRepository>(),
        },
        { provide: AudioFormatAdapter, useValue: mock<AudioFormatAdapter>() },
        {
          provide: FillerWordDetectorAdapter,
          useValue: mock<FillerWordDetectorAdapter>(),
        },
      ],
    }).compile();

    gateway = module.get<InterviewWebSocketGateway>(InterviewWebSocketGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should handle client connection', () => {
    const mockClient = {
      url: 'ws://localhost/interview',
      sessionId: undefined,
    } as any;

    gateway.handleConnection(mockClient);

    // Should not throw error
    expect(gateway).toBeDefined();
  });

  it('should handle client disconnection', () => {
    const mockClient = {
      sessionId: 'test-session',
    } as any;

    gateway.handleDisconnect(mockClient);

    // Should not throw error
    expect(gateway).toBeDefined();
  });

  it('should handle initialization message', async () => {
    const mockClient = {
      sessionId: undefined,
      send: jest.fn(),
    } as any;

    const mockData = {
      sessionId: 'test-session',
      candidateId: 'test-candidate',
    };

    mockSessionService.getSession.mockResolvedValue({
      sessionId: 'test-session',
      candidateId: 'test-candidate',
      communicationMode: 'voice',
    });

    await gateway.handleInit(mockData, mockClient);

    expect(mockSessionService.getSession).toHaveBeenCalledWith('test-session');
    expect(mockClient.sessionId).toBe('test-session');
  });

  it('should handle audio message', async () => {
    const mockClient = {
      sessionId: 'test-session',
      send: jest.fn(),
    } as any;

    const mockData = {
      sessionId: 'test-session',
      audio: Buffer.from('test audio').toString('base64'),
    };

    mockSessionService.getSession.mockResolvedValue({
      sessionId: 'test-session',
      communicationMode: 'voice',
    });
    mockTranscriptRepository.appendMessage.mockResolvedValue(undefined);

    await gateway.handleAudio(mockData, mockClient);

    // expect(mockSessionService.getSession).toHaveBeenCalledWith('test-session');
    // Session validation removed from handleAudio for performance, relies on connection state
  });

  it('should handle text message', async () => {
    const mockClient = {
      sessionId: 'test-session',
      send: jest.fn(),
    } as any;

    const mockData = {
      sessionId: 'test-session',
      text: 'Hello',
    };

    mockTranscriptRepository.appendMessage.mockResolvedValue(undefined);

    await gateway.handleMessage(mockData, mockClient);

    expect(mockTranscriptRepository.appendMessage).toHaveBeenCalled();
  });
});
