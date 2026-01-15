/**
 * Google Speech Adapter Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GoogleSpeechAdapter } from '../../../../infrastructure/adapters/voice/google-speech.adapter';
import { ConfigService } from '@nestjs/config';

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
    synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: Buffer.from('test-audio') }]),
    close: jest.fn(),
  })),
}));

describe('GoogleSpeechAdapter', () => {
  let adapter: GoogleSpeechAdapter;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    // Mock global fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('mock_error'),
        json: () => Promise.resolve({ results: [{ alternatives: [{ transcript: 'Mock transcription' }] }] }),
        arrayBuffer: () => Promise.resolve(Buffer.from('mock_audio')),
      }),
    ) as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleSpeechAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<GoogleSpeechAdapter>(GoogleSpeechAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should throw error for speechToText when API key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    await expect(newAdapter.speechToText(audioBuffer)).rejects.toThrow(
      'Google Cloud API key not configured',
    );
  });

  it('should return mock transcription when API key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-api-key');
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    const result = await newAdapter.speechToText(audioBuffer);

    expect(result).toContain('Mock transcription');
  });

  it('should throw error for textToSpeech when API key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);

    await expect(newAdapter.textToSpeech('test text')).rejects.toThrow(
      'Google Cloud API key not configured',
    );
  });

  it('should return mock audio when API key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-api-key');
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);

    const result = await newAdapter.textToSpeech('test text');

    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
